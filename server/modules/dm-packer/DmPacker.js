/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */
'use strict';

let archiver = require('archiver');
let co = require('co');
let nugetHttp = require('./nuget-http');
let simpleHttp = require('./simple-http');
let dm = require('./deployment-map');
let retryLib = require('./retry');
let config = require('config');


module.exports = function DmPacker(logger) {

  let retry = retryLib({logger: logger, maxAttempts: 4});

  this.buildCodeDeployPackage = function (deploymentMap) {
    let options = {
      nugetRootUrl: config.getUserValue('local').nugetRootUrl
    };

    return retry(tryDownload).then(archive => archive, error => {
      logger.error(`${failureMessage()}:
      ${error.message}`);
      logger.error(error.message);
      return Promise.reject(error);
    });

    function tryDownload() {
      return co(function* () {
        try {
          logger.info("Packaging started");
          logger.info(`Downloading Package: ${JSON.stringify(deploymentMap)}`);
          let toDownload = yield nugetHttp.getDownloadPlan(options.nugetRootUrl, deploymentMap);
          let files = yield toDownload.map(item => downloadFile(item));
          let entryStream = yield dm.getCodeDeployEntries(deploymentMap, files, options, logger);
          let archive = archiver.create("zip", {});
          archive.on("entry", entry => logger.info(`Appended ${entry.name} to package`));
          archive.on("finish", () => {
            logger.info("Package written to S3");
            logger.info("Packaging complete");
          });
          archive.on('error', err => {
              throw err;
          });
          entryStream.on("data", entry => {
            archive.append(entry.content, { name: entry.path });
          });
          entryStream.once("end", () => archive.finalize());
          return archive;
        } catch (error) {
          let message = failureMessage();
          logger.warn(message);
          logger.warn(`${error.message}`);
          throw error;
        }
      });
    }

    function failureMessage() {
      return `Failed to download package: ${deploymentMap.id} version ${deploymentMap.version}`;
    }
  };

  this.getCodeDeployPackage = function (url) {
    return co(function* () {
      let input = yield simpleHttp.getResponseStream(url);
      let headers = input.headers;
      if (!(/\/zip$/.test(headers["content-type"]))) {
        throw new Error(`Expected a zip file. ${url}`);
      }
      return input;
    });
  };

  this.uploadCodeDeployPackage = function (destination, stream, s3client) {
    return new Promise((resolve, reject) => {
      s3client.upload({
        Bucket: destination.bucket,
        Key: destination.key,
        Body: stream
      }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
      //.on('httpUploadProgress', evt => { logger.info(evt); });
    });
  };

  function downloadFile(item) {
    return co(function* () {
      logger.info(`GET ${item.downloadUrl}...`);
      let responseStream = yield simpleHttp.getResponseStream(item.downloadUrl);
      logger.info(`RECEIVE ${item.downloadUrl}`);

      return {
        id: item.id,
        version: item.version,
        contentStream: responseStream
      };
    });
  }
};

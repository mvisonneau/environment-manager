/* Copyright (c) Trainline Limited, 2016-2017. All rights reserved. See LICENSE.txt in the project root for license information. */

'use strict';

let { flow } = require('lodash/fp');
let { convertToNewModel, convertToOldModel } = require('modules/data-access/lbSettingsAdapter');
let loadBalancerSettings = require('modules/data-access/loadBalancerSettings');
let { getMetadataForDynamoAudit } = require('api/api-utils/requestMetadata');
let param = require('api/api-utils/requestParam');
let { versionOf } = require('modules/data-access/dynamoVersion');
let { removeAuditMetadata } = require('modules/data-access/dynamoAudit');
let { hasValue, when } = require('modules/functional');
let { ifNotFound, notFoundMessage } = require('api/api-utils/ifNotFound');

const sns = require('modules/sns/EnvironmentManagerEvents');

function convertToApiModel(persistedModel) {
  let apiModel = removeAuditMetadata(persistedModel);
  let Version = versionOf(persistedModel);
  return Object.assign(apiModel, { Version });
}

// let notify = sns.publish.bind(sns);
let notify = console.log.bind(console);

/**
 * GET /config/lb-settings
 */
function getLBSettingsConfig(req, res, next) {
  const environmentName = param('environment', req);
  const frontend = param('frontend', req);
  const loadBalancerGroup = param('loadBalancerGroup', req);

  function filterExpression(expressions) {
    let { length } = expressions;
    if (length === 0) {
      return {};
    } else if (length === 1) {
      let [FilterExpression] = expressions;
      return { FilterExpression };
    } else {
      let FilterExpression = ['and', ...expressions];
      return { FilterExpression };
    }
  }

  let filterExpressions = [
    (frontend !== undefined)
      ? ['=', ['at', 'Value', 'FrontEnd'], ['val', frontend !== false]]
      : undefined,
    (loadBalancerGroup !== undefined && environmentName !== undefined)
      ? ['=', ['at', 'LoadBalancerGroup'], ['val', loadBalancerGroup]]
      : undefined
  ];

  let expressions = Object.assign(
    (environmentName !== undefined)
      ? { KeyConditionExpression: ['=', ['at', 'EnvironmentName'], ['val', environmentName]] }
      : {},
    (loadBalancerGroup !== undefined && environmentName === undefined)
      ? {
        IndexName: 'LoadBalancerGroup-index',
        KeyConditionExpression: ['=', ['at', 'LoadBalancerGroup'], ['val', loadBalancerGroup]]
      }
      : {},
    filterExpression(filterExpressions.filter(x => x !== undefined))
  );

  console.log(expressions);

  let getData = expressions.KeyConditionExpression
    ? () => loadBalancerSettings.query(expressions)
    : () => loadBalancerSettings.scan(expressions);

  return getData()
    .then(data => res.json(data))
    .catch(next);
}

/**
 * GET /config/lb-settings/{environment}/{vHostName}
 */
function getLBSettingConfigByName(req, res, next) {
  const key = {
    EnvironmentName: param('environment', req),
    VHostName: param('vHostName', req)
  };
  return loadBalancerSettings.get(key)
    .then(when(hasValue, flow(convertToOldModel, convertToApiModel)))
    .then(ifNotFound(notFoundMessage('lb-setting')))
    .then(send => send(res))
    .catch(next);
}

/**
 * POST /config/lb-settings
 */
function postLBSettingsConfig(req, res, next) {
  return Promise.resolve()
    .then(() => {
      const body = param('body', req);
      let metadata = getMetadataForDynamoAudit(req);
      let key = {
        EnvironmentName: body.EnvironmentName,
        VHostName: body.VHostName
      };
      return convertToNewModel(Object.assign(key, body))
        .then((record) => {
          delete record.Version;
          return { record, metadata };
        });
    })
    .then(loadBalancerSettings.create)
    .then(() => res.status(201).end())
    .then(notify({
      message: 'Post /config/lb-settings',
      topic: sns.TOPICS.CONFIGURATION_CHANGE,
      attributes: {
        Action: sns.ACTIONS.POST,
        ID: ''
      }
    }))
    .catch(next);
}

/**
 * PUT /config/lb-settings/{environment}/{vHostName}
 */
function putLBSettingConfigByName(req, res, next) {
  const key = {
    EnvironmentName: param('environment', req),
    VHostName: param('vHostName', req)
  };
  const Value = param('body', req);
  const expectedVersion = param('expected-version', req);
  let metadata = getMetadataForDynamoAudit(req);

  return convertToNewModel(Object.assign(key, { Value }))
    .then(record => loadBalancerSettings.put({ record, metadata }, expectedVersion))
    .then(() => res.status(200).end())
    .then(notify({
      message: 'Put /config/lb-settings',
      topic: sns.TOPICS.CONFIGURATION_CHANGE,
      attributes: {
        Action: sns.ACTIONS.POST,
        ID: ''
      }
    }))
    .catch(next);
}

/**
 * DELETE /config/lb-settings/{environment}/{vHostName}
 */
function deleteLBSettingConfigByName(req, res, next) {
  const key = {
    EnvironmentName: param('environment', req),
    VHostName: param('vHostName', req)
  };
  const expectedVersion = param('expected-version', req);
  let metadata = getMetadataForDynamoAudit(req);

  return loadBalancerSettings.delete({ key, metadata }, expectedVersion)
    .then(() => res.status(200).end())
    .then(notify({
      message: `Delete /config/lb-settings/${key}`,
      topic: sns.TOPICS.CONFIGURATION_CHANGE,
      attributes: {
        Action: sns.ACTIONS.DELETE,
        ID: ''
      }
    }))
    .catch(next);
}

module.exports = {
  getLBSettingsConfig,
  getLBSettingConfigByName,
  postLBSettingsConfig,
  putLBSettingConfigByName,
  deleteLBSettingConfigByName
};
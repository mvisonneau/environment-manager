/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */
'use strict';

const RESOURCE = 'config/services';
let dynamoHelper = new (require('api/api-utils/DynamoHelper'))(RESOURCE);

/**
 * GET /config/services
 */
function getServicesConfig(req, res, next) {
  const cluster = req.swagger.params.cluster.value;
  let filter = {};
  if (cluster !== undefined) {
    filter.OwningCluster = cluster;
  }
  return dynamoHelper.getAll(filter).then(data => res.json(data)).catch(next);
}

/**
 * GET /config/services/{name}
 */
function getServiceConfigByName(req, res, next) {
  const key = req.swagger.params.name.value;
  const sortKey = req.swagger.params.cluster.value;
  return dynamoHelper.getBySortKey(key, sortKey).then(data => res.json(data)).catch(next);
}

function postServicesConfig(req, res) {
  res.json();
}

function putServiceConfigByName(req, res, next) {
  const key = req.swagger.params.name.value;
  const sortKey = req.swagger.params.cluster.value;
  const user = req.user;
  const expectedVersion = req.swagger.params['expected-version'].value;
  const config = req.swagger.params.config.value;

  return dynamoHelper.updateWithSortKey(config, key, sortKey, expectedVersion, user).then(data => res.json(data)).catch(next);
}

/**
 * DELETE /config/services/{name}/{infra}
 */
function deleteServiceConfigByName(req, res) {
  res.json();
}

module.exports = {
  getServicesConfig,
  getServiceConfigByName,
  postServicesConfig,
  putServiceConfigByName,
  deleteServiceConfigByName
};
/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */
'use strict';

let co = require('co');
let serviceUpdater = require('modules/service-updater');
let DeploymentCommandHandlerLogger = require('commands/deployments/DeploymentCommandHandlerLogger');
let schema = require('modules/schema/schema');

module.exports = function UpdateTargetState(command) {
  let logger = new DeploymentCommandHandlerLogger(command);

  return co(function* () {
    yield schema('UpdateTargetStateCommand').then(x => x.conform(command));
    logger.info(`Updating key ${command.key}`);

    let key = command.key;
    let value = command.value;
    let options = command.options;

    return yield serviceUpdater.setTargetState(command.environment, { key, value, options });
  });
};

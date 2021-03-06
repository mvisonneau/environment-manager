/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */
'use strict';

let _ = require('lodash');
let co = require('co');
let sender = require('modules/sender');
let launchConfigurationClientFactory = require('modules/clientFactories/launchConfigurationClientFactory');
let EnvironmentType = require('models/EnvironmentType');
let Environment = require('models/Environment');
let taggable = require('./taggable');

function parseName(name) {
  let segments = name.split('-');

  return {
    environment: segments[0],
    clusterCode: segments[1],
    serverRole: segments[2],
    slice: segments[3] || null,
  };
}

class AutoScalingGroup {

  constructor(data) {
    _.assign(this, data);
    this.$nameSegments = parseName(this.AutoScalingGroupName);
  }

  getLaunchConfiguration() {
    let self = this;
    return co(function* () {
      let name = self.LaunchConfigurationName;
      let client = yield launchConfigurationClientFactory.create({ accountName: self.$accountName });
      return client.get({ name });
    });
  }

  getEnvironmentType() {
    return EnvironmentType.getByName(this.getTag('EnvironmentType'));
  }

  getServerRoleName() {
    return this.$nameSegments.serverRole;
  }

  getRuntimeServerRoleName() {
    let name = this.$nameSegments.serverRole;
    if (this.$nameSegments.slice !== null) {
      name += '-' + this.$nameSegments.slice;
    }
    return name;
  }

  static getByName(accountName, autoScalingGroupName) {
    return co(function* () {
      let query = {
        name: 'GetAutoScalingGroup',
        accountName,
        autoScalingGroupName,
      };

      let data = yield sender.sendQuery({ query });
      data.$accountName = accountName;
      data.$autoScalingGroupName = autoScalingGroupName;
      return data;
    });
  }

}

taggable(AutoScalingGroup);

module.exports = AutoScalingGroup;
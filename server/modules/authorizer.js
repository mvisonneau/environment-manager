/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */
'use strict';

let _ = require('lodash');
let intersect = require('glob-intersection');

module.exports = (usersPermissions, requiredPermissions) => {

  let unsatisfiedPermissions = requiredPermissions.filter(function (requiredPermission) {
    return !permissionIsSatisfied(requiredPermission, usersPermissions);
  });

  return {
    authorized: unsatisfiedPermissions.length === 0,
    unsatisfiedPermissions: _.uniqWith(unsatisfiedPermissions, _.isEqual),
  };

};

function permissionIsSatisfied(requiredPermission, usersPermissions) {

  var matchingPermissionFound = false;
  var resourceSatisfied = false;
  var requiredClusters = toRequiredAttributes(requiredPermission.clusters);
  var requiredEnvironmentTypes = toRequiredAttributes(requiredPermission.environmentTypes);

  usersPermissions.forEach(permission => {

    if (resourceAndAccessMatch(requiredPermission, permission)) {
      if (!isLimitedResourcePermission(permission)) {
        resourceSatisfied = true;
      } else if (limitationsOnResourcePermissionMatch(requiredPermission, permission)) {
        matchingPermissionFound = true;
      }
    }
    
    if (isClusterPermission(permission)) {
      satisfyRequiredClustersFromClusterPermission(requiredClusters, permission);
    }
    
    if (isEnvironmentTypePermission(permission)) {
      satisfyRequiredEnvironmentTypesFromEnvironmentTypePermission(requiredEnvironmentTypes, permission);
    }

  });

  return matchingPermissionFound || (resourceSatisfied &&
    attributesAreSatisfied(requiredClusters) &&
    attributesAreSatisfied(requiredEnvironmentTypes));
  
}

function limitationsOnResourcePermissionMatch(requiredPermission, permission) {
  var requiredClusters = toRequiredAttributes(requiredPermission.clusters);
  var requiredEnvironmentTypes = toRequiredAttributes(requiredPermission.environmentTypes);

  if (isClusterLimitedResourcePermission(permission))
    satisfyRequiredClustersFromResourcePermission(requiredClusters, permission);

  if (isEnvironmentTypeLimitedResourcePermission(permission))
    satisfyRequiredEnvironmentTypesFromResourcePermission(requiredEnvironmentTypes, permission);
  
  return attributesAreSatisfied(requiredClusters) &&
    attributesAreSatisfied(requiredEnvironmentTypes);
}

function isClusterPermission(permission) {
  let isLegacyClusterPermission = intersect(toLower(permission.Resource), '/permissions/clusters/*');
  let isClusterPermission = !!permission.Cluster;
  return isClusterPermission || isLegacyClusterPermission;
}

function isEnvironmentTypePermission(permission) {
  let isLegacyEnvironmentTypePermission = intersect(toLower(permission.Resource), '/permissions/environmenttypes/*');
  let isEnvironmentTypePermission = !!permission.EnvironmentType;
  return isEnvironmentTypePermission || isLegacyEnvironmentTypePermission;
}

function isLimitedResourcePermission(permission) {
  return isClusterLimitedResourcePermission(permission) ||
    isEnvironmentTypeLimitedResourcePermission(permission)
}

function isClusterLimitedResourcePermission(permission) {
  return permission.Clusters;
}

function isEnvironmentTypeLimitedResourcePermission(permission) {
  return permission.EnvironmentTypes;
}

function satisfyRequiredClustersFromResourcePermission(requiredClusters, permission) {
  requiredClusters.forEach(requiredCluster => {
    if (typeof permission.Clusters === 'string' && permission.Clusters.toLowerCase() === 'all') {
      requiredCluster.satisfied = true;
    } else {
      permission.Clusters.forEach(permittedCluster => {

        if (permittedCluster === requiredCluster.name)
          requiredCluster.satisfied = true;

      });
    }
  });
}

function satisfyRequiredEnvironmentTypesFromResourcePermission(requiredEnvironmentTypes, permission) {
  requiredEnvironmentTypes.forEach(requiredEnvironmentType => {
    if (typeof permission.EnvironmentTypes === 'string' && permission.EnvironmentTypes.toLowerCase() === 'all') {
      requiredEnvironmentType.satisfied = true;
    } else {
      permission.EnvironmentTypes.forEach(permittedEnvironmentType => {

        if (permittedEnvironmentType === requiredEnvironmentType.name)
          requiredEnvironmentType.satisfied = true;

      });
    }
  });
}

function satisfyRequiredClustersFromClusterPermission(requiredClusters, permission) {
  requiredClusters.forEach(requiredCluster => {

    let permittedCluster = toLower(permission.Cluster);

    let matchingCluster = (permittedCluster === 'all' || permittedCluster === requiredCluster.name);
    let matchingLegacyCluster = intersect(toLower(permission.Resource), `/permissions/clusters/${requiredCluster.name}`);

    if (matchingCluster || matchingLegacyCluster)
      requiredCluster.satisfied = true;
    
  });
}

function satisfyRequiredEnvironmentTypesFromEnvironmentTypePermission(requiredEnvironmentTypes, permission) {
  requiredEnvironmentTypes.forEach(requiredEnvironmentType => {

    let permittedEnvironmentType = toLower(permission.EnvironmentType);

    let matchingEnvironmentType = (permittedEnvironmentType === 'all' || permittedEnvironmentType === requiredEnvironmentType.name);
    let matchingLegacyEnvironmentType = intersect(toLower(permission.Resource), `/permissions/environmenttypes/${requiredEnvironmentType.name}`);

    if (matchingEnvironmentType || matchingLegacyEnvironmentType)
      requiredEnvironmentType.satisfied = true;
    
  });
}

function attributesAreSatisfied(attributes) {
  return attributes.every(attr => attr.satisfied);
}

function toRequiredAttributes(attributes) {
  if (!(attributes && attributes.length > 0)) return [];
  return attributes.map(function(attribute){
    return {
      name: attribute.toLowerCase(),
      satisfied: false
    }
  });
}

function resourceAndAccessMatch(requiredPermission, permission) {

  var requiredResource = requiredPermission.resource.toLowerCase();
  var requiredAccess = requiredPermission.access.toLowerCase();

  var permittedResource = toLower(permission.Resource);
  var permittedAccess = toLower(permission.Access);

  var resourceMatches = intersect(permittedResource, requiredResource);
  var accessMatches = permittedAccess === requiredAccess || permittedAccess === 'admin';

  return resourceMatches && accessMatches

}

function toLower(str) {
  if (str) return str.toLowerCase();
  return '';
}
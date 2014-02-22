/**
 * Copyright (c) ActiveState 2013 - ALL RIGHTS RESERVED.
 */

'use strict';

var Config = require('../lib/config');
var Helpers = {};

Helpers.randomModules = [ 'express', 'supertest', 'mocha', 'hapi',
                          'coffee-script', 'lodash' ];

Helpers.getRandom = function(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
};

Helpers.getRandomModule = function() {
    return Helpers.randomModules[Helpers.getRandom(0, Helpers.randomModules.length)];
};

Helpers.handleRes = function(err) {
    if (err) {
        throw err;
    }
};

Helpers.tarballPointsToMirror = function(res) {
    if (!res.body.dist.tarball) { return 'tarball field missing'; }
    if (res.body.dist.tarball.indexOf(Config.serverAddress + ':' + Config.realExternalPort) === -1) {
        return 'tarball URI does not map to the server external address:port';
    }
};

module.exports = Helpers;


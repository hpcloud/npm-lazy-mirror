/**
 * Copyright (c) ActiveState 2013 - ALL RIGHTS RESERVED.
 */

var Config = require('../lib/config');

var Helpers = {};

Helpers.randomModules = [ 'express', 'supertest', 'mocha', 'hapi'];

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
    if (!res.body.dist.tarball) return 'tarball field missing';
    if (res.body.dist.tarball.indexOf(Config.server_address + ':' + Config.real_external_port) === -1) {
        return 'tarball URI does not map to the server external address:port';
    }
};

module.exports = Helpers;


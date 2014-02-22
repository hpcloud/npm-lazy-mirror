/**
 * Copyright (c) ActiveState 2013 - ALL RIGHTS RESERVED.
 */

'use strict';

var Config = require('../lib/config');
var Helpers = require('./helpers');
var Mkdirp = require('mkdirp');
var Npm = require('npm');

var npmLogLevel = 'warn';
var nodeModulesDir = '/tmp/npm-lazy-test-modules';

Npm.load({loglevel: npmLogLevel}, function (err, npm) {
    npm.config.set('registry', 'http://' + Config.serverAddress + ':' + Config.realExternalPort);
    npm.config.set('prefix', nodeModulesDir);
    npm.config.set('global', true);

    describe('It should make the test install folder', function () {
        it('should create ' + nodeModulesDir, function (done) {
            new Mkdirp(nodeModulesDir, done);
        });
    });

    describe('It should install packages using the npm module', function (){
        this.timeout(20000);

        it('should install npm', function (done) {
            npm.commands.install(['npm'], done);
        });

        var rand1 = Helpers.getRandomModule();
        it('should install a random module: ' + rand1, function (done) {
            this.timeout(1000 * 60 * 3);
            npm.commands.install([rand1], done);
        });

    });
});

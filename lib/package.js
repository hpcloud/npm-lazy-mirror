/**
 * Copyright (c) ActiveState 2014 - ALL RIGHTS RESERVED.
 */

'use strict';

var Async = require('async');
var Cache = require('./cache');
var Constants = require('./constants');
var Fs = require('fs');
var Registry = require('./registry');
var Semver = require('semver');

/**
 * Provides a package class for working with package metadata and binary blobs.
 *
 * @constructor
 * @param {Object} opts - Options
 * @returns {Package}
 */
var Package = function (opts) {

    if (!this instanceof Package) {
        return new Package(opts);
    }

    opts = opts || {};

    if (!opts.name) { return new Error('Package name not found'); }
    if (!opts.config && (!opts.config.upstreamHost || !opts.config.upstreamPort)) {
        return new Error('Registry is invalid: ' + opts.config);
    }

    this.name = opts.name;
    this.version = opts.version;

    this.config = opts.config;
    this.cache = new Cache(this.config);
    this.registry = new Registry(this.config);
    return this;

};

/**
 * Gets the entire metadata for a package and stores it on disk and returns
 * the path to the stored file (JSON).
 *
 * @callback done - {err, path}
 */
Package.prototype.getMeta = function(cb) {

    var pkg = this;

    if (pkg.version) {
        var blacklisted = pkg.validateAgainstBlacklist();
        if (blacklisted) { return cb(blacklisted); }
    }

    pkg.cache.validate({
            type: Constants.TYPE_META,
            name: pkg.name
        },
        function (err, validity) {
            if (err) { return cb(err); }

            if (validity === Constants.CACHE_EXPIRED && pkg.config.cachePermitStale) {
                Async.waterfall([
                    function (done) {
                        pkg.registry.getMeta(pkg.name, function (err, meta) {
                            done(null, meta);
                        });
                    },
                    function (meta, done) {
                        if (!meta) {
                            pkg.cache.getMeta(pkg.name, done);
                        } else {
                            done(null, meta);
                        }
                    }
                ], cb);
            } else if (validity === Constants.CACHE_VALID) {
                pkg.cache.getMeta(pkg.name, cb);
            } else {
                Async.waterfall([
                    function (done) {
                        pkg.registry.getMeta(pkg.name, done);
                    },
                    function (meta, done) {
                        pkg.cache.setMeta(pkg.name, meta, done);
                    },
                    function (meta, done) {
                        pkg.cache.getMeta(pkg.name, done);
                    }
                ], function (err, result) {
                    if (err) { return cb(err); }
                    pkg.config.cache.fsStats.set(result, true);
                    cb(null, result);
                });
            }
        });
};

/**
 * Extracts the latest version metadata from the master metadata file
 *
 * @callback done - {err, path}
 */
Package.prototype.getLatestVersionMeta = function(done) {

    var pkg = this;

    pkg.getMeta(function (err, metaPath) {
        if (err) { return done(err); }

        Fs.readFile(metaPath, function (err, meta){
            if (err) { return done(err); }
            meta = meta.toString();
            var data;

            try {
                data = JSON.parse(meta);
            } catch (e) {
                return done(e);
            }

            if (data['dist-tags'].latest) {
                pkg.version = data['dist-tags'].latest;
                var blacklisted = pkg.validateAgainstBlacklist();
                if (blacklisted) { return done(blacklisted); }
                pkg.getVersionMeta(done);
            } else {
                done(new Error('Cannot determine the latest version from the metadata'));
            }
        });
    });
};

/**
 * Extracts the version metadata from the master metadata file, and creates a
 * separate file if necessary, for serving with a cache server.
 *
 * @callback done - {err, path}
 */
Package.prototype.getVersionMeta = function(done) {

    var pkg = this;

    if (!pkg.version) { return done(new Error('This package has no version')); }

    var blacklisted = pkg.validateAgainstBlacklist();
    if (blacklisted) { return done(blacklisted); }

    pkg.getMeta(function (err, metaPath) {
        if (err) { return done(err); }

        Fs.readFile(metaPath, function (err, meta){
            if (err) { return done(err); }
            meta = meta.toString();
            var data;

            try {
                data = JSON.parse(meta);
            } catch (e) {
                return done(e);
            }

            if(data.versions[pkg.version]) {
                pkg.cache.setMetaVersion(pkg, data.versions[pkg.version], function (err){
                    if (err) { return done(err); }
                    pkg.cache.getMetaVersion(pkg.name, pkg.version, done);
                });
            } else {
                var error = new Error('Version not found');
                error.code = 404;
                done(error);
            }
        });
    });
};

/**
 * Assembles the package, checks the cache validity and reponds with the
 * path to the tarball
 *
 * @callback cb - {err, path}
 */
Package.prototype.getTarball = function(cb) {

    var pkg = this;

    var blacklisted = pkg.validateAgainstBlacklist();
    if (blacklisted) { return cb(blacklisted); }


    Async.waterfall([
        function(done) {
            pkg.cache.validate({
                type: Constants.TYPE_TGZ,
                name: pkg.name,
                version: pkg.version
            }, done);
        },
        function(validity, done){
            if (validity === Constants.CACHE_VALID || (validity === Constants.CACHE_EXPIRED && pkg.config.cachePermitStale)) {
                pkg.getTarballFromMeta(done);
            } else {
                pkg.registry.getTarball(pkg, done);
            }
        }
    ],
    cb);
};

/**
 * Extracts the tarball from the original JSON, and stores it in the package
 * directory, then returns the local path to it.
 * @callback cb = {err, path}
 */
Package.prototype.getTarballFromMeta = function (cb) {
    var pkg = this;

    pkg.getMeta(function(err, metaPath) {
        if (err) { return cb(err); }
        Fs.readFile(metaPath, function(err, meta){
            if (err) { return cb(err); }
            meta = meta.toString();
            var data;

            try {
                data = JSON.parse(meta);
            } catch (e) {
                return cb(e);
            }

            if (pkg.version) {
                if(data.versions[pkg.version]) {
                    pkg.cache.getTarball(pkg.name, pkg.version, cb);
                } else {
                    var error = new Error('Version not found');
                    error.code = 404;
                    return cb(error);
                }
            } else {
                return cb(new Error('Version not supplied'));
            }
        });
    });
};

/**
 * Validates the package name and semver against a supplied blacklist file.
 * Will return an error if the particular package is blacklisted, otherwise
 * undefined.
 *
 * @return {Error/undefined}
 */
Package.prototype.validateAgainstBlacklist = function () {

    var pkg = this;
    if (!pkg.version) {
        return new Error('Cannot validate a package with no version');
    }

    if (pkg.config.packageBlacklist && pkg.config.packageBlacklist[pkg.name]) {
        if (Semver.satisfies(pkg.version, pkg.config.packageBlacklist[pkg.name])) {
            return new Error('Package ' + pkg.name + ' version: ' + pkg.config.packageBlacklist[pkg.name] + ' is blacklisted');
        }
    }
    return;
};


module.exports = Package;

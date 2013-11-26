/**
 * Copyright (c) ActiveState 2013 - ALL RIGHTS RESERVED.
 */

var _ = require('lodash');
var Async = require('async');
var Cache = require('./cache');
var Fs = require('fs');
var Lactate = require('lactate');
var Registry = require('./registry');
var Request = require('request');


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
    if (!opts.config && (!opts.config.upstream_host || !opts.config.upstream_port)) {
        return new Error('Registry is invalid: ' + opts.config);
    }

    this.name = opts.name;

    var version_spl = _.compact(this.name.split('/'));
    if (version_spl.length === 1) { version_spl = version_spl[0].split('-'); }

    if (!opts.version && version_spl.length == 2 && version_spl[1].match(/\d+\.\d+\.\d+/)) {
        this.name = version_spl[0];
        this.version = version_spl[1];
    } else if (!opts.version && version_spl.length > 2 && version_spl[version_spl.length - 1].match(/\d+\.\d+\.\d+/)){
        this.version = version_spl.pop();
        this.name = version_spl.join('-');
    } else {
        this.version = opts.version || null;
    }

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

    pkg.cache.exists({type: 'meta', name: pkg.name}, function(err, exists){

        if (err) return cb(err);

        if (exists) {
            pkg.cache.getMeta(pkg.name, cb);
        } else {

            var package_meta;

            Async.series([
                function(done) {
                    pkg.registry.getMeta(pkg.name, function(err, meta){
                        package_meta = meta;
                        done(err, meta);
                    });
                },
                function(done) {
                    pkg.cache.setMeta(pkg.name, package_meta, done);
                },
                function(done) {
                    pkg.cache.getMeta(pkg.name, done);
                }
            ], function(err, results) {
                if (err) { return cb(err); }
                pkg.config.cache.fsStats.set(results[2], true);
                cb(null, results[2]);
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

    pkg.getMeta(done);
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

    pkg.getMeta(function(err, meta_path) {
        if (err) { return done(err); }

        Fs.readFile(meta_path, function(err, meta){
            if (err) { return done(err); }
            meta = meta.toString();
            var data;

            try {
                data = JSON.parse(meta);
            } catch (e) {
                return done(e);
            }

            if(data.versions[pkg.version]) {
                pkg.cache.setMetaVersion(pkg, data.versions[pkg.version], function(err){
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
 * Extracts the tarball from the original JSON, and stores it in the package
 * directory, then returns the local path to it.
 *
 * @callback cb - {err, path}
 */
Package.prototype.getTarball = function(cb) {

    var pkg = this;
    var tarball_exists = false;

    Async.series([
        function(done) {
            pkg.cache.exists({type: 'tgz', name: pkg.name, version: pkg.version}, function(err, exists){
                tarball_exists = exists;
                done(err);
            });
        },
        function(done){

            if (tarball_exists === true) {

                pkg.getMeta(function(err, meta_path) {
                    if (err) { return done(err); }

                    Fs.readFile(meta_path, function(err, meta){
                        if (err) { return done(err); }
                        meta = meta.toString();
                        var data;

                        try {
                            data = JSON.parse(meta);
                        } catch (e) {
                            return done(e);
                        }

                        if (pkg.version) {
                            if(data.versions[pkg.version]) {
                                pkg.cache.getTarball(pkg.name, pkg.version, done);
                            } else {
                                var error = new Error('Version not found');
                                error.code = 404;
                                return done(error);
                            }
                        } else {
                            return done(new Error('Version not supplied'));
                        }
                    });
                });

            } else {
                return pkg.registry.getTarball(pkg, done);
            }
        }],
        function(err, tarball_path) {
            cb(err, tarball_path[1]);
        });
};


module.exports = Package;

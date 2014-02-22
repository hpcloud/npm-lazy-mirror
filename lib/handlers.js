/**
 * Copyright (c) ActiveState 2014 - ALL RIGHTS RESERVED.
 */

'use strict';

var _ = require('lodash');
var Log = require('log');
var Package = require('./package');

var log = new Log();

var Handler = {};

/**
 * Serves the entire metadata for a package
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 */
Handler.servePackageMeta = function(req, res, config) {

    new Package({
        name: req.url.replace(/^\/|\/$/g, ''),
        config: config
    })
    .getMeta(function(err, meta) {
        if (err && err.code === 404) { return Handler.notFound(res, res); }
        if (err) { return Handler.internalErr(req, res, err); }
        meta = meta.replace(config.cacheDir, '');
        config.cacheServer.serve(meta, req, res);
    });
};

/**
 * Serves the version subset metadata for a package
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 */
Handler.servePackageVersionMeta = function(req, res, config) {

    var pkg = _.compact(req.url.split('/'));
    new Package({
        name: pkg[0],
        version: pkg[1],
        config: config
    })
    .getVersionMeta(function(err, meta) {
        if (err || !meta) { return Handler.internalErr(req, res, err); }
        meta = meta.replace(config.cacheDir, '');
        config.cacheServer.serve(meta, req, res);
    });
};

/**
 * Serves the latest version subset metadata for a package
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 */
Handler.serveLatestPackageMeta = function(req, res, config) {

    new Package({
        name: req.url.replace(/^\/|\/$/g, '').replace(/\/latest\/?$/, ''),
        config: config
    })
    .getLatestVersionMeta(function(err, meta) {
        if (err || !meta) {
            if (err.code === 404) { return Handler.notFound(res, res); }
            return Handler.internalErr(req, res, err);
        }
        meta = meta.replace(config.cacheDir, '');
        config.cacheServer.serve(meta, req, res);
    });

};

/**
 * Serves the binary .tgz for a package, as requisitioned from the 'dist' key
 * in the package metadata.
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 */
Handler.servePackageTarball = function(req, res, config) {

    var name, version;
    var nameSplit = req.url.split('/-/');
    name = nameSplit[0].replace('/', '');
    if (nameSplit.length > 1) {
        version = nameSplit[1].replace('.tgz', '').replace(name + '-', '');
    }

    new Package({
        name: name,
        version: version,
        config: config
    })
    .getTarball(function(err, tarball) {

        if (err && err.code === 404) {
            return Handler.notFound(req, res);
        } else if (err && !tarball) {
            return Handler.internalErr(req, res, err);
        }

        tarball = tarball.replace(config.cacheDir, '');
        config.cacheServer.serve(tarball, req, res);
    });
};

/**
 * Handle generic 404s
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 * @param {Object} err - err object
 */
Handler.notFound = function(req, res) {
    var msg = 'Resource not found: ' + req.url;
    log.info(msg);
    res.statusCode = 404;
    res.end(msg);
};

/**
 * Handle generic errors
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 * @param {Object} err - err object
 */
Handler.internalErr = function(req, res, err) {
    log.error('Internal request handler error: ', err);
    res.statusCode = 500;
    res.end('Internal server error ' + err);
};


module.exports = Handler;


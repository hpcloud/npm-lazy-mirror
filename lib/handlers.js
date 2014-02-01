/**
 * Copyright (c) ActiveState 2013 - ALL RIGHTS RESERVED.
 */

var _ = require('lodash');
var Log = require('log');
var Package = require('./package');
var Path = require('path');

var log = new Log();

var Handler = {};

/**
 * Serves the entire metadata for a package
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 */
Handler.servePackageMeta = function(req, res, config) {
    var p =  new Package({
        name: req.url,
        config: config
    })
    .getMeta(function(err, meta) {
        if (err && err.code === 404) { return Handler.notFound(res, res); }
        if (err) { return Handler.internalErr(req, res, err); }
        meta = meta.replace(config.cache_dir, '');
        config.cache_server.serve(meta, req, res);
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
    var p =  new Package({
        name: pkg[0],
        version: pkg[1],
        config: config
    })
    .getVersionMeta(function(err, meta) {
        if (err || !meta) { return Handler.internalErr(req, res, err); }
        meta = meta.replace(config.cache_dir, '');
        config.cache_server.serve(meta, req, res);
    });
};

/**
 * Serves the latest version subset metadata for a package
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 */
Handler.serveLatestPackageMeta = function(req, res, config) {

    var p =  new Package({
        name: req.url,
        config: config
    })
    .getLatestVersionMeta(function(err, meta) {
        if (err || !meta) { 
            if (err.code === 404) { return Handler.notFound(res, res); }
            return Handler.internalErr(req, res, err); }
            meta = meta.replace(config.cache_dir, '');
            config.cache_server.serve(meta, req, res);
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
    var name_split = req.url.split('/-/');
    name = name_split[0].replace('/', '');
    if (name_split.length > 1) {
        version = name_split[1].replace('.tgz', '').replace(name + '-', '');
    }

    var p =  new Package({
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

        tarball = tarball.replace(config.cache_dir, '');
        config.cache_server.serve(tarball, req, res);
    });
};

/**
 * Handle generic 404s
 *
 * Not used thus far.
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 * @param {Object} err - err object
 */
Handler.notFound = function(req, res) {
    var msg = 'Resource not found: ' +req.url;
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


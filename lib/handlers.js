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
            if (err) { return internalErr(req, res, err); }
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

    var p =  new Package({
        name: req.url,
        config: config
    })
    .getVersionMeta(function(err, meta) {
        if (err || !meta) { return internalErr(req, res, err); }
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
        if (err || !meta) { return internalErr(req, res, err); }
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

    var name = _.compact(_.without(req.url.split('/'), '-'));
    if (name.length !== 2) {
        return Handler.internalErr(req, res);
    } else {
        name = Path.basename(name[1], '.tgz');
    }

    var p =  new Package({
        name: name,
        config: config
     })
    .getTarball(function(err, tarball) {
        if ((err && !err.code) || !tarball) {
            return Handler.internalErr(req, res, err);
        }
        tarball = tarball.replace(config.cache_dir, '');
        config.cache_server.serve(tarball, req, res);
    });
};

/**
 * Handle generic 404s
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


var Package = require('./package');

var handler = {};

/**
 * Serves the entire metadata for a package
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 */
handler.servePackageMeta = function(req, res, config) {
        var p =  new Package({
            name: req.url,
            config: config
        })
        .getMeta(function(err, meta) {
            if (err) { return internalErr(req, res, err); }
            meta = meta.replace(Config.cache_dir, '');
            Config.cache_server.serve(meta, req, res);
        });
};

/**
 * Serves the version subset metadata for a package
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 */
handler.servePackageVersionMeta = function(req, res, config) {

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
handler.serveLatestPackageMeta = function(req, res, config) {

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
handler.servePackageTarball = function(req, res, config) {

    var name = _.compact(_.without(req.url.split('/'), '-'));
    if (name.length !== 2) {
        return internalErr(req, res);
    } else {
        name = Path.basename(name[1], '.tgz');
    }

    var p =  new Package({
        name: name,
        config: config
     })
    .getTarball(function(err, tarball) {
        if (err || !tarball) { return internalErr(req, res, err); }
        tarball = tarball.replace(config.cache_dir, '');
        config.cache_server.serve(tarball, req, res);
    });
};

module.exports = handler;


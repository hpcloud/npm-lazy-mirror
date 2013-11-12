# Lazy mirroring for NPM
---

## About

This package provides a lazy mirroring options for those that:

  * Don't want to mirror the entire couchDB for npmjs.org
  * Don't want to setup cron jobs for those tasks
  * Want to use an in-memory caching server (allocation configurable)
  * Want to easily cache dist tarballs to disk

## Install

  * `npm install -g npm-lazy-mirror`
  * `npm-lazy-mirror -p <port> -a <remote_address> --cache-dir /npm-data`

Then point your local npm config to the lazy mirror:

   npm config set registry http://localhost:8080/

## Features

  * Caching all tarballs to disk
  * Caching all metadata to disk
  * Mirror serves files (200MB max by default) from memory, with an LRU.
  * Upstream resources are fetched on the fly from the remote registry, the fetching, storing and serving to the client all happen in the same request.

## Caveats

To serve the tarballs, the mirror rewrites the location of the tarball for a
package in the metadata. This means that clients who use this mirror must be continue to do so,
or the worst case scenario is to remove the local `node_modules` and reinstall from the new registry.

## Todo

  * HTTPS
  * Indexing for `/all/-/` requests
  * Automatic disk pruning of stale resources
  * Resource locking to prevent multiple requests to the upstream registry
  * Tests


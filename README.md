# Lazy mirroring for NPM
---

## About

This package provides a lazy mirroring option for those that:

  * Don't want to mirror the entire couchDB for npmjs.org
  * Don't want to setup cron jobs for those tasks
  * Want to use an in-memory caching server (allocation configurable)
  * Want to easily cache dist tarballs and package metadata to disk

## Install

  * `npm install -g npm-lazy-mirror`

## Run

  * `npm-lazy-mirror -p <port> -a <remote_address> -b <bind_address> --cache-dir /npm-data`

Your `remote_address` is important, as it is the address used when re-writing
tarball URLs in the metadata. It's certainly always best to use a DNS entry here,
rather than an IP.

Then point your local npm config to the lazy mirror (permanent):

    npm config set registry http://localhost:2000/

or per install:

    npm i --registry http://localhost:2000 supertest

## Help

Run `npm-lazy-mirror -h` to see a full list of options.

## Features

  * Caching all tarballs to disk
  * Caching all metadata to disk
  * Mirror serves files (200MB max by default) from memory, with an LRU.
  * Upstream resources are fetched on the fly from the remote registry, the fetching, storing and serving to the client all happen in the same request.
  * Configurable with other npm registries.
  * It's Fast and stands up under load. Expect 5000+ req/s with one core.

A cold run installing `express` takes ~12 seconds (fetching from upstream registry on-the-fly):

    npm install express  2.44s user 0.81s system 27% cpu 11.769 total

A warm run after all `express` assets are locally cached takes ~3 seconds:

    npm install express  2.43s user 0.78s system 115% cpu 2.768 total

## Caveats

To serve the tarballs, the mirror rewrites the location of the tarball for a
package in the metadata. This means that clients who use this mirror must be continue to do so,
or the worst case scenario is to remove the local `node_modules` and reinstall from the new registry.

Additionally, you cannot use this mirror for publishing / user login.

## Todo

  * Indexing for `/all/-/` requests
  * Automatic disk pruning of stale resources
  * Resource locking to prevent multiple requests to the upstream registry


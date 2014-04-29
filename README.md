#npm-lazy-mirror
---

A lazy mirroring local npm server.

[![Build Status](https://travis-ci.org/ActiveState/npm-lazy-mirror.svg?branch=master)](https://travis-ci.org/ActiveState/npm-lazy-mirror)

## About

This package provides a lazy mirroring option for those that:

  * Don't want to mirror the entire couchDB for npmjs.org
  * Don't want to setup cron jobs for those tasks
  * Want to use an in-memory caching server (allocation configurable)
  * Want to easily cache dist tarballs and package metadata to disk

## Install

  * `npm install -g npm-lazy-mirror`

## Run

With CLI flags:

  * `npm-lazy-mirror -p <port> -a <remote_address> -b <bind_address> --cache_dir /npm-data`

With a JSON configuration:

  * `npm-lazy-mirror -C /path/to/config,json`

  See `example/server-config.json` for usage.

**Note:** Your `remote_address` configuration is important, as it is the address used when re-writing
tarball URLs in the metadata. It's certainly always best to use a DNS entry here,
rather than an IP.

## Client configuration

Simply point your local npm config to the lazy mirror (permanent):

    npm config set registry http://localhost:2000/

or per install:

    npm i --registry http://localhost:2000 supertest

## Help

Run `npm-lazy-mirror -h` to see a full list of options.

## Features

  * Caches all tarball / JSON metadata to disk
  * Mirror serves files (200MB max by default) from memory, with a configurable LRU cache.
  * Ability to blacklist packages by semantic versioning specification
  * Option to serve stale resources while the upstream registry is offline
  * Upstream resources are fetched on the fly from the remote registry, the fetching, storing and serving to the client all happen in the same request.
  * Configurable with custom npm registries.
  * HTTP/S proxy support
  * It's Fast and stands up under load. Expect 5000+ req/s with one core.

A cold run installing `express` takes ~12 seconds (fetching from upstream registry on-the-fly):

    npm install express  2.44s user 0.81s system 27% cpu 11.769 total

A warm run after all `express` assets are locally cached takes ~3 seconds:

    npm install express  2.43s user 0.78s system 115% cpu 2.768 total

## Implementation Caveats

You cannot use this mirror for publishing modules or user management, such
requests will be forwarded to the upstream registry for processing.

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
  * It's Fast and stands up under load. Here we are running a standard `wrk` benchmark for the entire package metadata for `superdata` (232k file) (core i7 / 16GB ram, only 1 core utilized and using ~125MB of memory during the benchmark):

    -> % wrk http://localhost:2000/supertest
    Running 10s test @ http://localhost:2000/supertest
      2 threads and 10 connections
      Thread Stats   Avg      Stdev     Max   +/- Stdev
        Latency     3.50ms    4.70ms  21.79ms   92.61%
        Req/Sec     2.18k   642.27     2.78k    88.04%
      41101 requests in 10.00s, 2.39GB read
    Requests/sec:   4110.05
    Transfer/sec:    244.88MB

## Caveats

To serve the tarballs, the mirror rewrites the location of the tarball for a
package in the metadata. This means that clients who use this mirror must be continue to do so,
or the worst case scenario is to remove the local `node_modules` and reinstall from the new registry.

## Todo

  * Indexing for `/all/-/` requests
  * Automatic disk pruning of stale resources
  * Resource locking to prevent multiple requests to the upstream registry


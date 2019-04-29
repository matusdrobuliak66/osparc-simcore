#!/bin/bash
# http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euo pipefail
IFS=$'\n\t'

# show current images on system
docker images

# these variable must be available securely from travis
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

TRAVIS_PLATFORM_STAGE_VERSION=staging-$(date +"%Y-%m-%d").${TRAVIS_BUILD_NUMBER}.$(git rev-parse HEAD)
export DOCKER_IMAGE_PREFIX=itisfoundation
export DOCKER_IMAGE_TAG=master
make tag
make push

export DOCKER_IMAGE_TAG=$TRAVIS_PLATFORM_STAGE_VERSION
make tag
make push

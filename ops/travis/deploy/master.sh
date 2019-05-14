#!/bin/bash
# http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euo pipefail
IFS=$'\n\t'

# pull the current tested build
export DOCKER_IMAGE_TAG=$(exec ops/travis/helpers/build_docker_image_tag.sh)
make pull

# show current images on system
docker images

# these variable must be available securely from travis
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

# re-tag build to master-latest
export DOCKER_REGISTRY_NEW=${DOCKER_REGISTRY}
export DOCKER_IMAGE_TAG_NEW=master-latest
make tag
export DOCKER_IMAGE_TAG=${DOCKER_IMAGE_TAG_NEW}
make push

# re-tag build to master-DATE.BUILD_NUMBER.GIT_SHA
TRAVIS_PLATFORM_VERSION=master-$(date +"%Y-%m-%d").${TRAVIS_BUILD_NUMBER}.$(git rev-parse HEAD)
export DOCKER_IMAGE_TAG_NEW=$TRAVIS_PLATFORM_VERSION
make tag
export DOCKER_IMAGE_TAG=${DOCKER_IMAGE_TAG_NEW}
make push

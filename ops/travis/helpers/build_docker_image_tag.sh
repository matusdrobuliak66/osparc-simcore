#!/bin/bash
# Usage: build_docker_image_tag.sh
# returns the slugified name of the image tag that shall be used
# e.g.: current git branch name
# if on travis,
#   if on a branch: returns the name of the travis branch
#   if on a pull request: returns the name of the originating branch
#   if on master: returns "build"

# http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euo pipefail
IFS=$'\n\t'

if [ ! -v TRAVIS ] || [ $TRAVIS = "false" ]; then
    # no travis here so let's use the git name directly
    image_tag=$(git rev-parse --abbrev-ref HEAD)
else
    if [ "$TRAVIS_PULL_REQUEST" = "false" ]; then
        if [ "${TRAVIS_BRANCH}" = "master" ]; then
            # this is master branch and here we use a specific name to prevent naming colision
            # with the master-latest build
            image_tag="build"
        else
            image_tag=${TRAVIS_BRANCH}
        fi
    else
        # this is a pull request, let's use the name of the originating branch instead of a boring master
        image_tag=${TRAVIS_PULL_REQUEST_BRANCH}
    fi
fi

slugified_name=$(exec ops/travis/helpers/slugify_name.sh $image_tag)

echo "$slugified_name-latest"

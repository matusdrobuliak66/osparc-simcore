#!/bin/bash
# http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euo pipefail
IFS=$'\n\t'

FOLDER_CHECKS=(api/ apihub .travis.yml)

before_install() {
    if bash ops/travis/helpers/test_for_changes.sh "${FOLDER_CHECKS[@]}";
    then
        bash ops/travis/helpers/install_docker_compose.sh
        bash ops/travis/helpers/show_system_versions.sh
    fi
}

install() {
    if bash ops/travis/helpers/test_for_changes.sh "${FOLDER_CHECKS[@]}";
    then
        bash ops/travis/helpers/ensure_python_pip
        pip3 install -r api/tests/requirements.txt
        pip3 install -r services/apihub/tests/requirements.txt
    fi
}

before_script() {
    if bash ops/travis/helpers/test_for_changes.sh "${FOLDER_CHECKS[@]}";
    then
        pip list -v
    fi
}

script() {
    if bash ops/travis/helpers/test_for_changes.sh "${FOLDER_CHECKS[@]}";
    then
        pytest --cov=api --cov-append -v api/tests
        pytest --cov=services_apihub --cov-append -v services/apihub/tests
    else
        echo "No changes detected. Skipping unit-testing of apihub."
    fi
}

after_success() {
    if bash ops/travis/helpers/test_for_changes.sh "${FOLDER_CHECKS[@]}";
    then
        codecov
        coveralls
    fi
}

after_failure() {
    echo "failure... you can always write something more interesting here..."
}


# Check if the function exists (bash specific)
if declare -f "$1" > /dev/null
then
  # call arguments verbatim
  "$@"
else
  # Show a helpful error
  echo "'$1' is not a known function name" >&2
  exit 1
fi

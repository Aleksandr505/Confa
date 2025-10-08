#!/bin/bash

BASE_PATH="src/main/resources/space/confa"

slugify() {
  local text="$1"
  local slug=$(echo "$text" | tr '[:upper:]' '[:lower:]')
  slug=$(echo "$slug" | sed -e 's/[^a-z0-9]/_/g' -e 's/__*/_/g')
  echo "$slug"
}

replace_dash() {
    local input="$1"
    echo "${input//-/}"
}

MODULE_PATH=$1
MIGRATION_NAME=$(slugify "$2")
MIGRATION_COMMENT=$3
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATION_AUTHOR=${LIQUIBASE_CONFA_AUTHOR:-$(git config user.name)}

SQL_FILE_NAME="${TIMESTAMP}_${MIGRATION_NAME}.sql"

FULL_PATH="${MODULE_PATH}/${BASE_PATH}/$(replace_dash "$MODULE_PATH")/db/changelog/scripts/${SQL_FILE_NAME}"
CHANGELOG_FILE="${MODULE_PATH}/${BASE_PATH}/$(replace_dash "$MODULE_PATH")/db/changelog/liquibase-changelog.yaml"

touch "${FULL_PATH}"

echo "-- liquibase formatted sql
-- changeset ${MIGRATION_AUTHOR}:${TIMESTAMP}
-- comment: ${MIGRATION_COMMENT}" >> "${FULL_PATH}"

echo "Created new migration file at ${FULL_PATH}."

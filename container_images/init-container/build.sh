#!/usr/bin/env bash

set -e

#
# Licensed Materials - Property of tenxcloud.com
# (C) Copyright 2016 TenxCloud. All Rights Reserved.
# @Author: huangxin
# @Date:   2016-10-24 

UPLOADER_PATH=`pwd`

# Pause the container for maintain work
if [ ! -z "$PAUSE_ENV" ]; then
    tail -f /dev/null
fi

if [ ! -z "$GIT_REPO_URL" ]; then
    echo -e "Host $GIT_REPO_URL\n\tStrictHostKeyChecking no\n" >> ~/.ssh/config
fi

#Prepare private / public keys
if [ ! -z "$PUB_KEY" ]; then
    echo $PUB_KEY > /root/.ssh/id_rsa.pub
fi
if [ ! -z "$PRI_KEY" ]; then
    echo -e $PRI_KEY | tr " " "\n" | tail -n +5 | head -n -4  > key
    echo  -e "-----BEGIN RSA PRIVATE KEY-----" > /root/.ssh/id_rsa
    cat key >> /root/.ssh/id_rsa
    rm key
    echo -e "-----END RSA PRIVATE KEY-----\n"  >> /root/.ssh/id_rsa
    chmod 600 /root/.ssh/id_rsa
fi

echo "=> Preparing build environment ..."

rm -rf $CLONE_LOCATION/* && rm -rf $CLONE_LOCATION/.??*
rm -rf .git

if [ ! -z "$GIT_REPO" ]; then
    rm -rf $CLONE_LOCATION/*
    if [ ! -z "$REPO_TYPE" ] && [ "$REPO_TYPE" == '7' ]; then
        echo "   svn checkout $GIT_REPO"
        if [ ! -z "$SVN_USERNAME" ] && [ ! -z "$SVN_PASSWORD" ]; then
            #svn checkout -q --no-auth-cache --non-interactive --trust-server-cert --trust-server-cert-failures unknown-ca,cn-mismatch --username $SVN_USERNAME --password $SVN_PASSWORD $GIT_REPO $CLONE_LOCATION
            svn checkout -q --non-interactive --trust-server-cert-failures=unknown-ca,cn-mismatch,expired,not-yet-valid,other --username $SVN_USERNAME --password $SVN_PASSWORD $GIT_REPO $CLONE_LOCATION
        else
            svn checkout -q --non-interactive --trust-server-cert-failures=unknown-ca,cn-mismatch,expired,not-yet-valid,other $GIT_REPO $CLONE_LOCATION
        fi
        if [ $? -ne 0 ]; then
            echo "   ERROR: Error checkout $GIT_REPO"
            exit 1
        fi
        cd $CLONE_LOCATION
    else
        echo "   git clone $GIT_REPO"
        git clone -q $GIT_REPO $CLONE_LOCATION
        if [ $? -ne 0 ]; then
            echo "   ERROR: Error cloning $GIT_REPO"
            exit 1
        fi
        cd $CLONE_LOCATION
        if [ ! -z "$GIT_TAG" ]; then
            echo "Switching branch to $GIT_TAG"
            git checkout $GIT_TAG
        fi
        echo "   git submodule update --init --recursive"
        git submodule update --init --recursive
    fi
else
    echo "   Build without remote repositry"
fi

if [ ! -z "$PREVIOUS_BUILD_LEGACY_PATH" ]; then
    echo "=> Moving the legacies of previous stage build to the directory where image will be built"
    mkdir -p $CLONE_LOCATION
    # Use cp instead of mv, or it maybe conflict with target directory
    cp -r $PREVIOUS_BUILD_LEGACY_PATH/* $CLONE_LOCATION
    rm -rf $PREVIOUS_BUILD_LEGACY_PATH/*
fi

if [ ! -z "$BUILD_DOCKER_IMAGE" ]; then
    echo "=> Checking if the online Dockerfile should be used"

    if [ ! -z "$ONLINE_DOCKERFILE" ]; then
        echo "   Saving online Dockerfile into directory $CLONE_LOCATION "
        mkdir -p $CLONE_LOCATION
        echo -e "$ONLINE_DOCKERFILE" > $CLONE_LOCATION/Dockerfile
        echo "====== Start Of Dockerfile ====="
        cat $CLONE_LOCATION/Dockerfile
        echo "====== End Of Dockerfile ======="
    else 
        echo "   Build using local Dockerfile"
    fi

    if [ ! -z "$UPLOAD_URL" ]; then
        echo "=> Uploading Dockerfile and README.md"
        cd $UPLOADER_PATH
        node /upload.js
    fi
fi

if [ ! -z "$SCRIPT_ENTRY_INFO" ]; then
    echo "=> Downloading ci script"
    node /download.js
fi

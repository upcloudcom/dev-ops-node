#!/bin/bash
set -e

MODE=${RUNNING_MODE}
CLEAN_ALL_FILES_FLAG="false"

build_dev_flows_api() {
  set -x

  echo "start build backend files ..."
  outputPath="dist"

  rm -rf ${outputPath}

  node_modules/.bin/webpack --progress

  # 只有在执行脚本时传递 '--clean=all' 参数，构建完成后才会删除源文件
  if [ "${CLEAN_ALL_FILES_FLAG}" = "--clean=all" ]; then
    echo "will delete all source files ..."
    mv static ${outputPath}
    ls | grep -v ${outputPath} | grep -v node_modules | xargs rm -rf
    mv ${outputPath}/* ./
    rm -rf ${outputPath}
  fi

  set +x
}

project="dev-flows-api 2.0"
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
  cat << EOF
Run the command the build release of the ${project}:
sh build.sh
EOF
#注意： Windows下也可使用（需要安装git）
else
  echo "start build ${project}"
  echo "node_env: ${NODE_ENV}"
  echo "running_mode: ${MODE}"
  echo "CLEAN_ALL_FILES_FLAG: ${1}"

  if [ "$1" = "--clean=all" ]; then
    CLEAN_ALL_FILES_FLAG="--clean=all"
  fi

  # build backend files
  build_dev_flows_api

  echo "build ${project} success"
fi
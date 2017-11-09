#!/bin/bash
urls="projecturls.txt"
folder="timed_tests"

# Download 102 test projects into the "timed_tests" folder
# Usage: source little_benchmark.sh; download
download() {
  node index.js downloadTestProjects $urls $folder;
}

# Test the downloaded projects
# Usage: source little_benchmark.sh; run
run() {
  node index.js timeTests $folder 102;
}

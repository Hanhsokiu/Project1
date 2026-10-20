#!/bin/bash
set -e
echo "Running automated CI test suite..."
echo "Backend testing..."
npm --prefix backend run test
echo "Frontend testing..."
npm --prefix frontend run test
echo "All tests passed!"

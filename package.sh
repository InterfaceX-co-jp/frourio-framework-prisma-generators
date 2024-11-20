#!/bin/bash
START_TIME=$SECONDS

echo "Buidling package..."
rm -r lib
npm run generate
rm -r package
mkdir package

echo "Copying files..."
cp -r lib package/lib
cp package.json README.md package

echo "Making package.json public..."
sed -i 's/"private": true/"private": false/' ./package/package.json

ELAPSED_TIME=$(($SECONDS - $START_TIME))
echo "Done in $ELAPSED_TIME seconds!"

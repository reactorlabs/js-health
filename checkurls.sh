#!/bin/bash
# Checks if repos of the form https://github.com... exist
while IFS=, read -r col1 col2 col3; do
	if git ls-remote $col3 -q; then
		printf "."
	else
		echo "$col3 failed"
	fi
done < "$1"

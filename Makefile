# https://www.client9.com/self-documenting-makefiles/
help: ## Shows help
	@awk -F ':|##' '/^[^\t].+?:.*?##/ {\
	printf "\033[36m%-30s\033[0m %s\n", $$1, $$NF \
	}' $(MAKEFILE_LIST)

package-publish: ## Publish package to npm
	npm update
	npm run check-uncommitted
	sh ./package.sh
	cd package 
	npm publish

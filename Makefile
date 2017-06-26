.PHONY: docker-build


docker-build: 
	docker build -t index.tenxcloud.com/tenx_containers/tenx-cicd-service:v1.2 -f Dockerfile .

docker-build-ppc64le:
	docker build -t index.tenxcloud.com/tenx_containers/tenx-cicd-service-ppc64le:v1.2 -f Dockerfile.ppc64le .

docker-push-ppc64le:
	docker push index.tenxcloud.com/tenx_containers/tenx-cicd-service-ppc64le:v1.2
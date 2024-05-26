# strava-api
![build_test](https://github.com/dlchoi-91/strava-api/actions/workflows/build_test.yml/badge.svg)

## Testing and Workflow
.env is used locally for running tests locally for secrets and variables. A pull request into main will initiate workflows but are currently configured to approve before running API tests. Before approving, make sure the local runner is running on the local server (see below). All other steps (CodeQL and Lint) will run without approval on non-local runners. Building the test docker image will not trigger until tests pass. Live API is configured to use the `latest` tag and Docker image will be updated on succesful pull request. 

Lint step is built in workflow but not configured currently and will not run on any files. Pending to-do!

## Github Actions Local Runner
The API tests are currently configured to run on a personal server that has access to the test database. It's not currently running as a service and I manually run the local runner when testing. To run githubactions runner, run command `./actions-runner/run.cmd`. The runner can be configured as a [service to start when booting](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/configuring-the-self-hosted-runner-application-as-a-service). 



## To-Do List
- [ ] Helm charts updates in test
- [ ] Configure lint.
- [ ] Include ingress, namespaces etc. in helm charts
- [ ] Prod to helm deploy
---
title: Streamlining Development with Automated CI Processes
date: "2024-03-29"
description: ""
tags: ["software engineering"]
---

One of the joys of the software development is finding ways to automate things. My least favorite type task is one that is long and cumbersome yet critical, so that no mistake can be made. These tasks are ripest for automation.

On the Mindbody marketing engineering team, we've implemented a CI (Continuous Integration) setup using GitHub Actions that automates several such tasks. This setup not only saves time but also enhances the quality and dependability of our projects. 

For some background, we have two Drupal 10 websites hosted on Pantheon that share several resources, including these CI processes. We therefore host the processes as callable workflows in a dedicated third repo. Then, within the repos for each site, we have a very simple workflow for each process that only sets a value for `on`, e.g. on a set schedule or on the opening of a PR, and then calls the workflow in the host repo.

### Example of a callable workflow hosted in a dedicated third repo
```yaml
name: Nightly dependency update

on:
  workflow_call:
    secrets:
      secret1:
        required: true
      secret2:
        required: true

jobs:
  dependency-update:
# Rest of the job steps...
```

### Example workflow thats calls the callable workflow. This is placed in each site's repo.
```yaml
name: Nightly dependency update
# Nightly dependency update: This script automates the process of updating project dependencies.

on:
  # # For testing purposes
  # pull_request:
  #    types: [opened, synchronize, closed]

  schedule:
    - cron: '0 9 * * *' # Run at 2 am Pacific time (9 am UTC)

jobs:
  call-workflow-passing-data:
    uses: path/to/callable/workflow
    secrets:
      secret1: ${{ secrets.secret1 }}
      secret2: ${{ secrets.secret2 }}
```

Now onto the process themselves. They can be broken down into two categories: daily automations and pull-request based.

## Daily Automations

### Config Sync

When a configuration change is made on a live site, our config-sync workflow exports it to YAML and opens a PR with the changes. This allows the dev team to review the changes before they are made permanent and ensures they will not be overwritten the next time config is synced.

```yaml
name: Nightly action that opens a PR with any config changes made on the live site.
on:
  workflow_call:
    secrets:
      pantheon_site_name:
        required: true
      pantheon_ssh_key:
        required: true
      ssh_config:
        required: true
      pantheon_machine_token:
        required: true

jobs:
  check:
    runs-on: ubuntu-latest
    env:
      pantheon_site: ${{ secrets.PANTHEON_SITE_NAME }}
    steps:
      # Checkout master.
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      
      # Execute the Setup Runner (to install Terminus) 
      - id: setup-runner
        name: Setup Runner
        uses: path/to/callable/repo/.github/actions/setup@master
        with:
          pantheon_ssh_key: ${{ secrets.PANTHEON_SSH_KEY }}
          ssh_config: ${{ secrets.SSH_CONFIG }}
          pantheon_machine_token: ${{ secrets.PANTHEON_MACHINE_TOKEN }}

      - id: check-config
        name: Check if there is any config to export on live
        run: |
          if ! (terminus drush $pantheon_site.live -- config:status 2>&1 | grep "No differences"); then
            echo "Config changes found"
          else
            echo "No config changes found"
            exit 1
          fi
        
  config-sync:
    needs: check
    runs-on: ubuntu-latest
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      pantheon_site: ${{ secrets.PANTHEON_SITE_NAME }}
    steps:
      # Checkout master.
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      # Execute the Setup Runner (to install Terminus) 
      - id: setup-runner
        name: Setup Runner
        uses: path/to/callable/repo/.github/actions/setup@master
        with:
          pantheon_ssh_key: ${{ secrets.PANTHEON_SSH_KEY }}
          ssh_config: ${{ secrets.SSH_CONFIG }}
          pantheon_machine_token: ${{ secrets.PANTHEON_MACHINE_TOKEN }}

      - name: Export config changes to code.
        run: |

          # Create config-sync multidev by copying live.
          terminus multidev:create $pantheon_site.live config-sync --quiet

          # Change this new multidev to sftp mode.
          terminus connection:set $pantheon_site.config-sync sftp 
          
          # Export config to code.
          terminus drush $pantheon_site.config-sync -- config:export -y --verbose

          # Wait for 10 seconds before committing code otherwise Pantheon might not be aware of the code changes.
          sleep 10

          # Clear cache before committing code otherwise Pantheon might not be aware of the code changes.
          terminus env:clear-cache $pantheon_site.config-sync 

          # Commit config changes.
          terminus env:commit --message "config sync" -- $pantheon_site.config-sync 
         
          # Change the dev environment back to git mode.
          terminus connection:set $pantheon_site.config-sync git --yes

          #  Get the GIT URL of the config-sync multidev.
          GIT_URL="$(terminus connection:info --format=string --fields='git_url' -- $pantheon_site.config-sync)"

          # Pull changes.
          git config user.name "$(git --no-pager log --format=format:'%an' -n 1)"
          git config user.email "$(git --no-pager log --format=format:'%ae' -n 1)"
          git remote add pantheon $GIT_URL
          git fetch pantheon
          git checkout -b config-sync
          git cherry-pick pantheon/config-sync
          git push -u origin config-sync --force

      - name: create pull request
        run: gh pr create -B master --title 'Config sync' --body 'Sync this repo with config changes made on Live.'
    
      - name: Delete config-sync multidev so that it can be recreated next time with the latest code and db from Live.
        if: always()
        run: terminus multidev:delete --delete-branch $pantheon_site.config-sync --yes
```

### Dependency Updates

Every morning, this Action checks and updates both Composer and npm dependencies. It then opens a PR with these updates, allowing our team to review and merge them if necessary. This approach ensures we're always up-to-date with the latest security patches and features with while taking up almost no developer time. If the PR contains only minor updates that are not worth deploying, it can be left open and will be updated the next morning.

```yaml
name: Nightly dependency update
# Nightly dependency update: This script automates the process of updating project dependencies.

on:
  workflow_call:
    secrets:
      pantheon_site_name:
        required: true
      pantheon_ssh_key:
        required: true
      ssh_config:
        required: true
      pantheon_machine_token:
        required: true

jobs:
  dependency-update:
    runs-on: ubuntu-latest
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      pantheon_site: ${{ secrets.PANTHEON_SITE_NAME }}
    steps:
      # Checkout master.
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          ref: master
          fetch-depth: 0

      - name: Setup Runner
        uses: path/to/callable/repo/.github/actions/setup@master
        with:
          pantheon_ssh_key: ${{ secrets.PANTHEON_SSH_KEY }}
          ssh_config: ${{ secrets.SSH_CONFIG }}
          pantheon_machine_token: ${{ secrets.PANTHEON_MACHINE_TOKEN }}

      - name: Create or checkout branch
        run: |
          git fetch origin
          git checkout -b automated-updates

      - name: Update Composer dependencies
        run: composer update --no-interaction --no-progress --no-suggest

      - name: Update NPM dependencies
        working-directory: web/themes/mindbody
        run: npm update

      - name: Commit and push changes
        run: |
          git config user.name "$(git --no-pager log --format=format:'%an' -n 1)"
          git config user.email "$(git --no-pager log --format=format:'%ae' -n 1)"
          git add .
          git commit -m "Update dependencies"
          git push -u origin automated-updates --force

      - name: Check if pull request exists
        id: pr_check
        run: |
          PR_NUMBER=$(gh pr list --json number,headRefName,baseRefName --repo ${{ github.repository }} | jq -r '.[] | select(.headRefName=="automated-updates" and .baseRefName=="master") | .number')
          if [[ -z "$PR_NUMBER" ]]; then 
            echo "::set-output name=exists::false"
          else 
            echo "::set-output name=pr_number::$PR_NUMBER"
            echo "::set-output name=exists::true"
          fi

      - name: Update existing pull request
        if: steps.pr_check.outputs.exists == 'true'
        run: |
          TIMESTAMP=$(date -u)
          gh pr edit ${{ steps.pr_check.outputs.pr_number }} --body "This pull request updates the dependencies based on the latest versions available. Last updated at: $TIMESTAMP"

      - name: Create pull request
        if: steps.pr_check.outputs.exists != 'true'
        run: gh pr create --base master --head automated-updates --title 'Update dependencies' --body 'This pull request updates the dependencies based on the latest versions available.'
  ```

### Copy Live database to Staging

To ensure our staging environment mirrors the live production environment as closely as possible, we automatically copy the live database to our staging environment each morning. This ensures that all merged PRs are tested against the latest data, providing an accurate representation of their impact.

```yaml
name: Daily action that copies the live db to dev so that all pushes to master are tested against the latest database.
on:
  workflow_call:
    secrets:
      pantheon_site_name:
        required: true
      pantheon_ssh_key:
        required: true
      ssh_config:
        required: true
      pantheon_machine_token:
        required: true

jobs:
  clone-live-db-to-dev:
    name: Clone the live database to dev.
    runs-on: ubuntu-latest
    env:
       GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
       pantheon_site: ${{ secrets.PANTHEON_SITE_NAME }}
    steps:
      # Checkout master.
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      # Execute the Setup Runner (to install Terminus) 
      - id: setup-runner
        name: Setup Runner
        uses: path/to/callable/repo/.github/actions/setup@master
        with:
          pantheon_ssh_key: ${{ secrets.PANTHEON_SSH_KEY }}
          ssh_config: ${{ secrets.SSH_CONFIG }}
          pantheon_machine_token: ${{ secrets.PANTHEON_MACHINE_TOKEN }}

      - name: Clone live database to dev.
        run: |
          terminus env:clone-content --db-only --no-interaction --yes -vvv -- $pantheon_site.live dev
```


## PR-based Automations

### Deploy new PRs to a Dev Copy of the Site and run tests

Upon opening or modifying a PR, our CI system automatically spins up a dev copy of the live site. This environment is used to run Playwright end-to-end tests against the changes. Subsequent commits to the PR trigger automatic deployments to this dev site and re-run the tests.

```yaml
name: Deploy Branch to Pantheon Multidev
on:
  workflow_call:
    secrets:
      pantheon_site_name:
        required: true
      pantheon_ssh_key:
        required: true
      ssh_config:
        required: true
      pantheon_machine_token:
        required: true

# Cancel in-progress jobs from this workflow and for this PR.
concurrency: 
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  pantheon_site: ${{ secrets.PANTHEON_SITE_NAME }}
  pantheon_env: "pr-${{ github.event.pull_request.number }}"

jobs:
  build-and-deploy:
    name: Build and push to Pantheon multidev
    runs-on: ubuntu-latest
    if: github.event.pull_request.state == 'open' # Don't run on a closed (e.g. merged) PR. 
    steps:
      # Checkout the most recently pushed commit.
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          ref: ${{github.event.pull_request.head.sha}}
          fetch-depth: 0
      - id: setup-runner
        name: Setup Runner
        uses: path/to/callable/repo/.github/actions/setup@master
        with:
          pantheon_ssh_key: ${{ secrets.PANTHEON_SSH_KEY }}
          ssh_config: ${{ secrets.SSH_CONFIG }}
          pantheon_machine_token: ${{ secrets.PANTHEON_MACHINE_TOKEN }}

      - name: Composer Install Dependencies
        run: composer install --optimize-autoloader --prefer-dist --no-progress --no-suggest --no-dev

      ## Build Theme
      - name: Build Theme Artifacts
        run: |
          cd web/themes/mindbody
          npm ci
          ./node_modules/gulp/bin/gulp.js buildCSS buildJS
          rm -r node_modules

      ## Deploy
      - name: Prepare for deploy 
        run: |
          composer run prepare-for-pantheon
          git config user.name "$(git --no-pager log --format=format:'%an' -n 1)"
          git config user.email "$(git --no-pager log --format=format:'%ae' -n 1)"
          commit_message=$(git log -1 --pretty=%B)
          git init
          git config --local gc.auto 0
          git add --force .

      - name: Create a new multidev environment (or push to an existing one). Post a message with a link to the multidev when it is created.
        run: |
          terminus -n build:env:create "$pantheon_site.live" "$pantheon_env" --yes --pr-id=${{github.event.pull_request.number}}

      ## Database updates and config import
      - name: Terminus Drush Updates
        run: |
          terminus -n drush $pantheon_site.$pantheon_env -- cache:rebuild
          terminus -n drush $pantheon_site.$pantheon_env -- cim -y
          terminus -n drush $pantheon_site.$pantheon_env -- updb --no-cache-clear -y 

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: build-and-deploy
    timeout-minutes: 60
    strategy:
      fail-fast: false
      matrix:
        shardIndex: [1, 2, 3, 4, 5]
        shardTotal: [5]
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          ref: ${{github.event.pull_request.head.sha}}
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
      - name: Run Playwright tests
        run: npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
        env:
          PLAYWRIGHT_TEST_BASE_URL: https://${{ env.pantheon_env }}-${{ env.pantheon_site }}.pantheonsite.io
      - uses: actions/upload-artifact@5d5d22a31266ced268874388b861e4b58bb5c2f3  # v4.3.1
        if: ${{ !cancelled() }}
        with:
          name: blob-report-${{ matrix.shardIndex }}
          path: blob-report
          retention-days: 1
  
  merge-reports:
    # Merge reports after playwright-tests, even if some shards have failed
    needs: [test]
    if: ${{ !cancelled() }}
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
    - uses: actions/setup-node@v4
      with:
        node-version: 18
    - name: Install dependencies
      run: npm ci

    - name: Download blob reports from GitHub Actions Artifacts
      uses: actions/download-artifact@v4
      with:
        path: blob-report
        pattern: blob-report-*
        merge-multiple: true

    - name: Merge into HTML Report
      run: npx playwright merge-reports --reporter html ./blob-report

    - name: Upload HTML report
      uses: actions/upload-artifact@v4
      with:
        name: html-report--attempt-${{ github.run_attempt }}
        path: playwright-report
        retention-days: 14
```

### Deploy merged PRs to Staging and running tests

When a PR is merged to the master branch, it triggers the build and deployment of our app to the staging server. This is followed by another round of Playwright tests, after which a Slack message is posted in our dev channel with the test results. This process not only validates the merge but also informs the team of the status in real-time. Additionally, the dev site associated with the merged PR is cleaned up, maintaining a lean environment.

```yaml
name: Deploy Branch to Pantheon Dev environment

on:
  workflow_call:
    secrets:
      pantheon_site_name:
        required: true
      pantheon_ssh_key:
        required: true
      ssh_config:
        required: true
      pantheon_machine_token:
        required: true
      slack_webhook_url:
        required: true
        
# Cancel in-progress jobs from this workflow.
concurrency: 
  group: ${{ github.workflow }}
  cancel-in-progress: true

env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  pantheon_site: ${{ secrets.PANTHEON_SITE_NAME }}
  pantheon_env: "dev"

jobs:
  build-and-deploy:
    name: Build and push to Pantheon dev
    runs-on: ubuntu-latest
    steps:
      # Checkout the most recently pushed commit.
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          fetch-depth: 0
      - id: setup-runner
        name: Setup Runner
        uses: path/to/callable/repo/.github/actions/setup@master
        with:
          pantheon_ssh_key: ${{ secrets.PANTHEON_SSH_KEY }}
          ssh_config: ${{ secrets.SSH_CONFIG }}
          pantheon_machine_token: ${{ secrets.PANTHEON_MACHINE_TOKEN }}

      - name: Composer Install Dependencies
        run: composer install --optimize-autoloader --prefer-dist --no-progress --no-suggest --no-dev

      ## Build Theme
      - name: Build Theme Artifacts
        run: |
          cd web/themes/mindbody
          npm i
          ./node_modules/gulp/bin/gulp.js buildCSS buildJS
          rm -r node_modules

      ## Deploy
      - name: Deploy to dev
        run: |
          composer run prepare-for-pantheon
          git config user.name "$(git --no-pager log --format=format:'%an' -n 1)"
          git config user.email "$(git --no-pager log --format=format:'%ae' -n 1)"
          commit_message=$(git log -1 --pretty=%B)
          git init
          git config --local gc.auto 0
          git add --force .
          terminus -n build:env:push $pantheon_site.dev --message "CI Deploy: $commit_message"

       ## Database updates and config import
      - name: Terminus Drush Updates
        run: |
          terminus -n drush $pantheon_site.$pantheon_env -- updb --no-cache-clear -y --verbose
          terminus -n drush $pantheon_site.$pantheon_env -- cache:rebuild
          terminus -n drush $pantheon_site.$pantheon_env -- cim -y
  
  test:
    name: Test and deploy to Test
    runs-on: ubuntu-latest
    needs: build-and-deploy
    strategy:
      fail-fast: false
      matrix:
        shard: [1/5, 2/5, 3/5, 4/4, 5/5]
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          fetch-depth: 0
      - id: setup-runner
        name: Setup Runner
        uses: path/to/callable/repo/.github/actions/setup@master
        with:
          pantheon_ssh_key: ${{ secrets.PANTHEON_SSH_KEY }}
          ssh_config: ${{ secrets.SSH_CONFIG }}
          pantheon_machine_token: ${{ secrets.PANTHEON_MACHINE_TOKEN }}
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
      - name: Run Playwright tests
        run: npx playwright test --shard ${{ matrix.shard }}
        env:
          PLAYWRIGHT_TEST_BASE_URL: https://${{ env.pantheon_env }}-${{ env.pantheon_site }}.pantheonsite.io
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 1
      # If tests are successful, deploy to test environment so that we can deploy to live in one easy step.
      - name: Deploy to test
        if: ${{ matrix.shard }} == '5/5' && ${{ job.status }} == 'success'
        run: |
          terminus -n env:deploy $pantheon_site.test --updatedb --cc --note="Automated deployment after successful tests on dev."
  
  slack:
    name: Slack Notification
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          fetch-depth: 0
      - id: setup-runner
        name: Setup Runner
        uses: path/to/callable/repo/.github/actions/setup@master
        with:
          pantheon_ssh_key: ${{ secrets.PANTHEON_SSH_KEY }}
          ssh_config: ${{ secrets.SSH_CONFIG }}
          pantheon_machine_token: ${{ secrets.PANTHEON_MACHINE_TOKEN }}
      - name: Set variables
        run: |
          REPO_NAME=${{ github.event.repository.name }}
          echo "REPO_NAME=$REPO_NAME" >> $GITHUB_ENV

          MERGE_COMMIT_URL=${{ github.event.head_commit.url }}
          echo "MERGE_COMMIT_URL=$MERGE_COMMIT_URL" >> $GITHUB_ENV

          DASHBOARD_URL=$(terminus dashboard:view ${{ env.pantheon_site }} --print)
          echo "DASHBOARD_URL=$DASHBOARD_URL" >> $GITHUB_ENV

          if [[ "${{ job.status }}" == "success" ]]; then
            MESSAGE=":checked: Tests have passed on Dev. The production package has been deployed to Test and is ready to be deployed to Live."
          else
            MESSAGE=":pouting_cat: Tests have failed on Dev. The production package has been deployed to Dev and can manually be deployed to Test then Live if desired."
          fi
          echo "MESSAGE=$MESSAGE" >> $GITHUB_ENV
      - name: Send Slack message
        if: always()
        uses: slackapi/slack-github-action@v1.25.0
        with:
          payload: |
            { 
              "repo_name": "${{ env.REPO_NAME }}",
                "merge_commit_url": "${{ env.MERGE_COMMIT_URL }}",
                "dashboard_url": "${{ env.DASHBOARD_URL }}",
                "message": "${{ env.MESSAGE }}"
             }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
      
  delete-multidev:
    name: Delete old multidev environments associated with a PR that has been merged or closed.
    runs-on: ubuntu-latest
    env:
       GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
       pantheon_site: ${{ secrets.PANTHEON_SITE_NAME }}
    steps:
      # Checkout the most recently pushed commit.
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          fetch-depth: 0
      - id: setup-runner
        name: Setup Runner
        uses: path/to/callable/repo/.github/actions/setup@master
        with:
          pantheon_ssh_key: ${{ secrets.PANTHEON_SSH_KEY }}
          ssh_config: ${{ secrets.SSH_CONFIG }}
          pantheon_machine_token: ${{ secrets.PANTHEON_MACHINE_TOKEN }}

      - name: Delete Multidev
        run: |
          terminus -n build:env:delete:pr $pantheon_site --yes 
```


By automating these key processes, we've not only streamlined our development workflow but also enhanced the reliability and stability of our projects. Each step of our CI process is designed to ensure that by the time changes make their way to production, they have been thoroughly reviewed, tested, and approved. This systematization not only saves valuable time but also significantly reduces the chance of errors or oversights.
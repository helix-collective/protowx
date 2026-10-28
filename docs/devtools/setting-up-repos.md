# Setting up the repos

## TL;DR

The workspace holds four repositories. Each gets one GitHub repository
in one org:

| directory on disk            | GitHub repository         | what is pushed                   |
|------------------------------|---------------------------|----------------------------------|
| `protowx-workspace/`         | `<org>/protowx-workspace` | `main`, after the submodule edit |
| `protowx-workspace/protowx/` | `<org>/protowx`           | `main` and the tags              |
| `protowx-workspace/iac/`     | `<org>/protowx-iac`       | `main` and the tags              |
| none                         | `<org>/protowx-tools`     | nothing: the repository is empty |

The org is a shell variable, `ORG`. Set it once, in the first command.
Every later command reads it. Run all the commands in one shell.

```sh
# Set the org and the visibility, in the shell that runs the commands below.
# Change the org here, and nowhere else. VIS is private, public or internal.
ORG=helix-collective
VIS=private

# Check that gh is logged in. It needs the scopes repo and read:org.
gh auth status

# Check that the org exists. Expect one line: the org's name.
gh api "orgs/$ORG" --jq .login

# Check that none of the four repositories exists yet. Expect no output.
for r in protowx protowx-workspace protowx-iac protowx-tools; do gh repo view "$ORG/$r" --json name >/dev/null 2>&1 && echo "exists: $ORG/$r"; done

# protowx. From the workspace root, in protowx/, on main, with every change committed.
# It makes the repository, adds it as the remote origin, and pushes main.
cd protowx
git switch main
gh repo create "$ORG/protowx" "--$VIS" --description "protowx: a starter stack, with a calculator over integers" --source . --remote origin --push

# Push the tags. --push above pushes the branch only.
git push origin --tags

# protowx-iac. In iac/, on main, with every change committed.
# It makes the repository, adds it as the remote origin, and pushes main.
cd ../iac
git switch main
gh repo create "$ORG/protowx-iac" "--$VIS" --description "protowx-iac: the infrastructure of protowx, in Pulumi" --source . --remote origin --push

# Push the tags, if iac has any.
git push origin --tags

# protowx-tools. From any directory. It makes an empty repository and pushes nothing.
gh repo create "$ORG/protowx-tools" "--$VIS" --description "protowx-tools: the tools of protowx"

# protowx-workspace. In the workspace root, on main.
# It makes the repository and adds it as the remote origin. It does not push yet.
cd ..
git switch main
gh repo create "$ORG/protowx-workspace" "--$VIS" --description "protowx-workspace: protowx, protowx-iac and the libraries, as submodules" --source . --remote origin

# Point the submodules protowx and iac at their GitHub repositories.
# A URL that starts ../ resolves against origin, so the org is not in .gitmodules.
git config -f .gitmodules submodule.protowx.url ../protowx.git
git config -f .gitmodules submodule.iac.url ../protowx-iac.git
git submodule sync

# Commit .gitmodules, then push main and set its upstream.
git add .gitmodules
git commit -m "workspace: the submodules on GitHub"
git push -u origin main

# Check. In /tmp. A recursive clone gets the workspace and every submodule.
# Expect each submodule at the commit the workspace pins.
git clone --recurse-submodules "git@github.com:$ORG/protowx-workspace.git" /tmp/protowx-workspace-check
git -C /tmp/protowx-workspace-check submodule status
```

## The org

`ORG` is the only place the org is named. To use a different org, set
`ORG` to it and run the same block. Nothing in a tracked file names the
org:

- `gh repo create` writes the remote URL into `.git/config`, which git
  does not track.
- `.gitmodules` uses `../protowx.git` and `../protowx-iac.git`. Git
  resolves a URL that starts `../` against the workspace's `origin`. So
  `git@github.com:helix-collective/protowx-workspace.git` gives
  `git@github.com:helix-collective/protowx.git`.

`gh` needs a token with the scopes `repo` and `read:org`. Your GitHub
account needs the right to make repositories in the org.

## The order

Make `protowx` and `protowx-iac` first. The workspace pins a commit in
each, and a clone of the workspace fetches that commit from GitHub.
Push the workspace last, after the two submodules are on GitHub.

Make the workspace repository before you edit `.gitmodules`.
`git submodule sync` resolves `../protowx.git` against `origin`. With
no `origin`, it resolves against the workspace directory, and writes a
wrong path into `.git/config`.

## Gotchas

**The old submodule URLs do not work on GitHub.** `.gitmodules` had
`url = ./protowx` and `url = ./iac`. Git resolves `./protowx` against
`origin` too. That gives `.../protowx-workspace.git/protowx`, which is
not a repository. A clone from GitHub then fails at
`git submodule update`. The `../` URLs in the TL;DR fix this.

**`--push` pushes the current branch only.** It does not push a tag, so
`v0.1.0` on `protowx` needs `git push origin --tags`. It does not push
another branch either. Push a feature branch by hand if you need it on
GitHub.

**`tools/` is not `protowx-tools`.** The submodule `tools/` is a clone
of `wxio/repo-tools`, and the flake pins the hooks from there. The
TL;DR makes `protowx-tools` empty, and leaves `tools/` as it is.

**A second run fails.** `gh repo create` refuses a name that exists,
and refuses `--remote origin` when `origin` exists. Run the check
command first. To start again, delete the repository with
`gh repo delete "$ORG/<name>"`, and the remote with
`git remote remove origin`.

**Some files name `wxio/protowx`.** The README of the workspace,
`docs/structure/workspace-structure.md` and several files under `iac/`
still name the old org. This page does not change them. Grep for them
from the workspace root:

```sh
grep -rln 'wxio/protowx' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.prompts .
```

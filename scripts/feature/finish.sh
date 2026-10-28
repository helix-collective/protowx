#!/usr/bin/env bash
# task feature:finish -- <branch> [--no-scenario "<reason>"] [--message-file <path>]
#
# Merges <branch> into the local main in the merge worktree, ../protowx-merge,
# behind the gate. On green it moves main here to the merge commit, tags it
# merged/<branch>-YYYYMMDD, then pushes main and the tag. It does not fetch:
# origin/main never decides what is merged. A refused push leaves the merge
# on main here. It does not touch the branch's worktree. docs/devtools/merging-branches.md
# is the page. It is a script, not shell in Taskfile.yml, because it is
# longer than twenty lines.
#
# The merge message is a file. By default it is
# <git common dir>/feature-merge/<branch>.msg, which the merge-features
# skill writes; the command deletes that file after a green merge.
set -euo pipefail

no() {
  echo "feature:finish: $*"
  exit 1
}

branch= reason= msg= own=
while [ $# -gt 0 ]; do
  case $1 in
  --no-scenario | --message-file)
    [ $# -ge 2 ] && [ -n "$2" ] || no "$1 needs a value"
    if [ "$1" = --no-scenario ]; then reason=$2; else msg=$2; fi
    shift 2
    ;;
  -*) no "unknown flag $1" ;;
  *)
    [ -z "$branch" ] || no "name one branch only"
    branch=$1
    shift
    ;;
  esac
done
[ -n "$branch" ] || no 'name the branch: task feature:finish -- <branch> [--no-scenario "<reason>"]'
[ "$branch" != main ] || no "main is not a branch to finish"
[ "$(git branch --show-current)" = main ] || no "run from main's worktree"
[ -z "$(git status --porcelain --untracked-files=no)" ] ||
  no "main's worktree has changes; commit or stash them first, since main moves here on green"
git rev-parse -q --verify "refs/heads/$branch" >/dev/null || no "there is no branch $branch"

# The two refusals: a branch behind main, and a scenario
# that is still a todo, with no reason. Main is the local main, not
# origin/main.
git merge-base --is-ancestor main "$branch" ||
  no "$branch does not hold main; run task feature:refresh in the branch first"
[ -n "$(git rev-list main.."$branch")" ] || no "$branch has nothing that main lacks"
s=web/regression/scenarios/$branch.json
if [ -n "$(git diff --name-only main "$branch" -- web/)" ] &&
  { ! git cat-file -e "$branch:$s" 2>/dev/null || git show "$branch:$s" | grep -q '"todo"'; }; then
  [ -n "$reason" ] || no "scenario: todo $branch; write its steps, or give --no-scenario \"<reason>\""
fi
tag=merged/$branch-$(date +%Y%m%d)
! git rev-parse -q --verify "refs/tags/$tag" >/dev/null || no "the tag $tag exists"
if [ -z "$msg" ]; then
  msg=$(git rev-parse --path-format=absolute --git-common-dir)/feature-merge/$branch.msg
  own=yes
fi
[ -s "$msg" ] || no "no merge message: write it to $msg, or pass --message-file <path>"

# The merge worktree. A git -C on a directory that is not a worktree of
# this repository reaches the workspace repository above it, so the path
# must be in `git worktree list` before the first git -C.
m=$(cd .. && pwd -P)/protowx-merge
git worktree prune
if git worktree list --porcelain | grep -qxF "worktree $m"; then
  git -C "$m" merge --abort 2>/dev/null || true
  git -C "$m" reset -q --hard main
elif [ -e "$m" ]; then
  no "$m exists, and it is not a worktree of this repository"
else
  git worktree add -q --detach "$m" main
fi
echo "feature:finish: merging $branch in $m, at main $(git rev-parse --short main)"
if ! git -C "$m" merge -q --no-ff --no-commit "$branch"; then
  git -C "$m" diff --name-only --diff-filter=U
  git -C "$m" merge --abort
  no "the merge conflicts in the files above; run task feature:refresh in the branch"
fi

# The gate, on the merged tree. On red, the merge is abandoned.
log=$(mktemp)
trap 'rm -f "$log"' EXIT
pnpm --dir "$m/web" install --frozen-lockfile --silent
if ! task --dir "$m" gate 2>&1 | tee "$log"; then
  git -C "$m" merge --abort
  no "$(grep '^gate: red at' "$log" | tail -1); the merge is aborted; fix $branch on its branch, then finish again"
fi

# Green. The branch's commits kept the transcripts in commits of their
# own, so the merge commit holds both, and the guard hook is skipped.
{
  cat "$msg"
  [ -z "$reason" ] || printf '\nNo scenario: %s\n' "$reason"
} | SKIP=prompt-history-guard git -C "$m" commit -q -F - || {
  git -C "$m" merge --abort
  no "a commit hook refused the merge commit; fix the file it names on the branch, then finish again"
}
merged=$(git -C "$m" rev-parse HEAD)
git merge -q --ff-only "$merged" ||
  no "main moved during the finish; the merge commit $(git rev-parse --short "$merged") is not on main; finish again"
git tag "$tag" "$merged"
[ -z "$own" ] || rm -f "$msg"

# The push sends what main here already holds. A plain push never forces:
# when origin/main has commits that main lacks, origin refuses it and
# stays as it was.
if git push -q --atomic origin main "refs/tags/$tag"; then
  echo "feature:finish: $branch is merged as $(git rev-parse --short main), tagged $tag, and pushed"
else
  echo "feature:finish: $branch is merged as $(git rev-parse --short main) and tagged $tag on main here; the push was refused, so origin is unchanged; push later with: git push origin main $tag"
fi
echo "To remove the branch's worktree and the branch, run:"
echo "  git worktree remove ../protowx-$branch"
echo "  git branch -d $branch"

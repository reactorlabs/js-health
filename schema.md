# Projects

Each project will reside in its own directory, which would contain the following:

- `project.json` file which contains the metadata about the project (see below)
- for each analyzed commit a `commit-hash.json` file that would contain information about that particular project (see below)

## `project.json`

- project id (as reported by github)
- project name
- project full name (owner / name)
- project description
- project owner's id (as reported by github)
- is fork? 
- created at
- updated at
- pushed at
- size
- forks count
- stargazers count
- watchers count
- language
- has issues?
- open issues count
- default branch
- list of analyzed branches, for each branch contains name of the branch and latest commit to the branch

## Commit json file

- hash
- date
- message
- comment count
- author (name, email, github id if present)
- parents (list of hashes of parent commits)
- list of files updated by the commit, for each file contains its filename, state (modified, added, deleted), and unless deleted a hash of the contents of the file

# Files

For each unique file, we will store its contents. Instead of file id's we will use file hashes to identify the unique files. While this takes more space in the saved data, it means that merging is super trivial (no need to update project information, just copy hashes from second not present in first).

# Implementation Details

Projects will be stored in folders corresponding to their github ids. If we store them in 2000 folders, the github id modulo 2000, we should expect ~2000 projects in each one of them, which is manageable. 

Commits in a project are stored in directories corresponding to the first byte of the hash, i.e. for a maximum number of 70k commits per project, we will end up with ~280 files per folder and 256 folders, which is super manageable. 

For file hashes, they will be stored in a tree-like structure with first directory being first byte, second being second byte. This gives us ~ 500 files per directory if we assume 50 mil unique files (5x more than we saw without histories)

# Extensibility

This scheme only mimicks what is in git in a slightly more compact format, so all information required can be restored from these. It should be very easy to add analysis of other branches, or to append any information to any of the JSONs above. 

Similarly, incremental analysis is very straightforward. Because we start from latest commit, we can stop as soon as we encounter a commit we have already analyzed, so adding new commits we only cost us the communication required to get the new ones. 







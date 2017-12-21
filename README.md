# Installing `node.js`

Currently, we are using version `8.9.3`, in order to install this on Debian derivatives, do the following:

    curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
    sudo apt-get install -y nodejs

> TODO do something about npm too I guess, can anyone who runs this on a new machine check this? 

# Building

Simply run `npm install` in the repository root to install all dependencies. 

# Getting the Repositories

Currently, we use [ghtorrent](http://http://ghtorrent.org/) as the source of projects to download. 

> There is a plan to remove even this step and download projects directly from github, which we can do using the [`/repositories`](https://developer.github.com/v3/repos/#list-all-public-repositories) API path. However, the annoying thing is that the results of this search do not give us the language of the project and therefore we would essentially have to do a request per project to get only projects of certain languages, which is a lot of API hours. 


# Filtering projects

Once you have the database dump, extract its `projects.csv` file and call the filtering stage, which filters only the projects which are in the specified language:

    node --max-old-space-size=8192 index.js filter INPUT OUTPUT LANG1 LANG2 LANGN [--noforks]

where `INPUT` is absolute path to the `projects.csv` extracted from ghtorreent, `OUTPUT` is absolute path to a file that would contain only the filtered projects, `LANG1`...`LANGN` are languages to be filteres and the optional `--noforks` argument filters out any forked projects if used. 

Make sure to increase the heap size for the process using `--max-old-space-size` option with size in megabytes (8GB works just fine, but less should also be acceptable). 

# Downloading the repositories and their snapshots

First, the initial data must be downloaded. In our setting this means getting all Github projects for the specified language one by one and analyzing all their commits, saving the snapshots along the way. Note that depending on your language, this step might take *a lot* of time and require a lot of network bandwidth and disk space. This task is also IO bound so downloading the repositories on a fast SSD drive is highly recommended. 

    node download TOKENS INPUT OUTPUT

where `TOKENS` is path to a JSON file containing github API tokens that should be used to download the metadata, `INPUT` is path to the projects file (output of step `1`) and `OUTPUT` is path to the directory where the outputs will be saved. Additional arguments include:

- `--verbose` displays a summary statistics each 10 seconds
- `--skip-existing` makes sure that projects which have already been analyzed will not be reanalyzed again (ignoring whether they have changed since the analysis or not)

The downloader creates the following folders in the output directory:

- `projects` which contains for each successfully analyzed project a JSON file containing the information about the project (mostly github metadata, latest main branch commit, etc.). Projects are stored by their full names (user/repo).
- `commits` contains commits from all files, for each commit contains its date, author, commit message, parents and changes to *all* files. Commits are stored by their hash. 
- `snapshots` contains all unique versions of files that were observed in the projects and commits. Stored by their hashes.

In order to limit number of files per folder, all three are split into subfolders by various prefixes from the full names or hashes (3 letters from full names, 2/2 letters from hashes). 








/** Language specific settings for JavaScript.

    This file provides settings and functionality required to download and analyze JavaScript code on github, which also includes TypeScript and CoffeeScript projects. 

    If you want to add support for a new language, a good way is to copy this file and change its contents to reflect the language(s) you are interested in. 
*/

module.exports = {

    /** Returns the name of the language specification for debugging purposes.
     */
    Name : () => {
        return "JavaScript and friends";
    },

    /** Returns an array of languages that the specification is interested in. During the filter stage, only projects that declare a language from this list will be considered. 
     */
    ProjectLanguages : () => {
        return [ "JavaScript", "TypeScript", "CoffeeScript"];
    },

    /** Given a project and a path inside the project, determines whether the file should be tracked (i.e. its snapshots stored), or not. 
      
        If a file is not tracked, its changes are reflected on a commit level, but its snapshots are not downloaded locally. 

        While the project itself should not be required for the answer, it is provided so that its properties can be changed if needs be (say indicating a presence of certain file type in the project).
     */
    TrackFile : (project, path) => {
        if (path.includes("node_modules")) 
            return null; // denied file
        if (path.endsWith(".js") || (path.endsWith(".coffee") || (path.endsWith(".litcoffee")) || (path.endsWith(".ts"))))
            return true;
        if (path === "package.json")
            return true;
        // TODO perhaps add gulpfiles, gruntfiles, travis, etc. ?
        return false;
    }

}
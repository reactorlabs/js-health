/** Language specific settings for R.
*/

module.exports = {

    Name : () => {
        return "R";
    },

    ProjectLanguages : () => {
        return [ "R", "r"];
    },

    TrackFile : (project, path) => {
        if (path.endsWith(".r") || (path.endsWith(".R")))
            return true;
        return false;
    }

}

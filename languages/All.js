
module.exports = {

    /** Returns the name of the language specification for debugging purposes.
     */
    Name : () => {
        return "All files";
    },

    ProjectLanguages : () => {
        return [];
    },

    TrackFile : (project, path) => {
	return true;
    }

}

const counter = Symbol('counter');

module.exports = class Syncer{
    constructor(doneCallback)
    {
        this.doneCallback = doneCallback;
        this[counter] = 0;
    }

    waitForOne()
    {
        this[counter]++;
    }

    oneDone()
    {
        this[counter]--;

        let theBase = this;
        setTimeout(function(){
            if(theBase[counter] == 0 && theBase.doneCallback != undefined)
            {
                theBase.doneCallback();
                theBase.doneCallback = undefined;
            }
        }, 100);
    }
}
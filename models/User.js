const { default: mongoose } = require("mongoose");

const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true,
    },
    phone:{
        type:String,
        required:true
    },
    role:{
        type:String,
        enum:["super_admin","admin","sponsor","judge"],
        required:true
    },
    status: {
        type: String,
        enum: ["active", "inactive", "blocked"],
        default: "active",
      },
    profile:{
        type:String,
        // required:true,
    },
    assignedContests: [{ type: Schema.Types.ObjectId, ref: 'Season' }]

},{ timestamps: true });

module.exports = mongoose.model('User', UserSchema);
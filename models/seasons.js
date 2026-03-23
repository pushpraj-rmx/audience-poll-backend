const { default: mongoose } = require("mongoose");

const Schema = mongoose.Schema;

const seasonSchema = new Schema({
    contestId:{
        type: Schema.Types.ObjectId,
        ref: 'Contest',
        required: true,
    },
    title:{
        type: String,
        required: true,
    },
    slug:{
        type: String,
        unique: true,
        index: true,
    },
    description:{
        type: String,
        required: true,
    },
    longDescription:{
        type: String,
    },
    startDate:{
        type: Date,
    },
    endDate:{
        type: Date
    },
    logo:{
        type:String,
    },
    banner:{
        type:String,
    },
    pdf:{
        type:String,
    },
    location:{
        address: String,
        city: String,
        state: String,
        country: String,
        landmark: String
    },
    CreatedBy:{
        type:Schema.Types.ObjectId,
        ref:"User",
    },
    updatedBy:{
        type:String,
        default:null,
    },
    status:{
        type: String,
        enum:["upcoming","active","completed","cancelled"],
        default: "upcoming",
    },
    categories: [
        { type: String, required: true, trim: true}
    ],
    subCategories:[
        { type: String, trim: true }
    ],
    rounds:[
        {
            name:{
                type: String,
            },
            startDate: Date,
            endDate: Date,
            status:{
                type: String,
                enum:["upcoming","active","completed","cancelled"],
                default:"upcoming",
            },
            isVotingEnable:{
                type:Boolean,
                default: false
            },
            category:{type: String},
            subCategory: {type: String},
            participants:[
                {
                    type: Schema.Types.ObjectId,
                    ref:"Participant",
                }
            ]
        }
    ],
    admins:[{type:Schema.Types.ObjectId, ref:"User"}],
    judges:[{type:Schema.Types.ObjectId, ref:"User"}],
    sponsors:[{type:Schema.Types.ObjectId, ref:"User"}],
    participants:[
        { 
          participant: {type: Schema.Types.ObjectId, ref:"Participant"},
          category:{ type: String },
          subCategory: {type: String}  
        }
    ],
})

module.exports = mongoose.model("Season", seasonSchema)
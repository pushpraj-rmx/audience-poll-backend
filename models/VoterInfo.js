const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VoterInfoSchema = new Schema({
     contestId: { type: Schema.Types.ObjectId, ref: "Contest" },
  roundName: { type:String, required: true},
  participantId: { type: Schema.Types.ObjectId, ref: "Participant" },
  voterType: {
    type: String,
    enum: ["audience", "judge", "admin", "super_admin", "sponsor"],
    default: "audience",
  },
  voterDetails: {
    name: String,
    email: String,
    phone: String
  },
  step:{
    type: String,
    enum: ['scanned', 'info_submitted', 'final'],
    default: 'info_submitted'
  }
},{timestamps:true})

module.exports = mongoose.model('VoterInfo', VoterInfoSchema);
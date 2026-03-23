const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AnalyticsSchema = new Schema({
  contestId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Contest'
 },
  participantId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Participant' 
},
  totalStars: {
    type:Number
  },
  votesFromJudges: {
    type:Number
  },
  votesFromAudience: {
    type:Number
  },
  votesFromSponsors: {
    type:Number
  },
  qrScans: {
    type:Number
  },
  detailsSubmitted: {
    type:Number
  },
  finalVotes: {
    type:Number
  }
});

module.exports = mongoose.model('Analytics', AnalyticsSchema);
const User = require("../models/User");

exports.getAllAdmins = async (req, res) => {
  try {
    // Sanitize and parse page number
    let page = parseInt(req.query.page, 10);
    page = isNaN(page) || page < 1 ? 1 : page;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Build search filter
    const query = req.query.query;
    let searchFilter = { role: "admin" };

    if (query) {
      const regex = new RegExp(query, 'i');
      searchFilter = {
        role: "admin",
        $or: [
          { name: { $regex: regex } },
          { email: { $regex: regex } },
          { phone: { $regex: regex } }
        ]
      };
    }
    // Fetch filtered, paginated admins
    const admins = await User.find(searchFilter)
      .skip(skip)
      .limit(limit)
      .populate("assignedContests");

    // Count total for pagination
    const total = await User.countDocuments(searchFilter);

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      admins,
    });
  } catch (error) {
    console.error("Error in getAllAdmins:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAdminsBySeason = async (req, res) => {
  const { seasonId } = req.params;
  const { query, page = 1 } = req.query;

  if (!seasonId) {
    return res.status(400).json({ message: "Season ID is required" });
  }

  const limit = 10;
  const skip = (parseInt(page) - 1) * limit;
  try {
    // Build base filter
    const filter = {
      role: "admin",
      assignedContests: seasonId,
    };

    // If search query is provided, add case-insensitive search on name or email
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(filter);
    const admins = await User.find(filter)
      .skip(skip)
      .limit(limit).lean()
      // .populate("assignedContests");
    if (!admins)
      return res.status(404).json({ message: "Participant not found" });

    return res.status(200).json({
      currentPage: page,
      limit,
      totalAdmins: total,
      totalPages: Math.ceil(total / limit),
      admins,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

exports.alladmin = async (req,res)=>{
  try {   
    const data = await User.find({role:'admin',status:'active'})
    res.send({success:true,data})
  } catch (error) {
    console.log(error)
    return res.status(500).json({ error: error.message });
  }
}

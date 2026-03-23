const User = require("../models/User");

exports.getAllSponsors = async (req, res) => {
  try {
    // Sanitize and parse page number
    let page = parseInt(req.query.page, 10);
    page = isNaN(page) || page < 1 ? 1 : page;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Build search filter
    const query = req.query.query;
    let searchFilter = { role: "sponsor" };

    if (query) {
      const regex = new RegExp(query, "i");
      searchFilter = {
        role: "sponsor",
        $or: [
          { name: { $regex: regex } },
          { email: { $regex: regex } },
          { phone: { $regex: regex } },
        ],
      };
    }

    // 👇 Only fetch users with role = sponsor
    const sponsors = await User.find(searchFilter)
      .skip(skip)
      .limit(limit)
      .populate("assignedContests");

    // Also get total count for pagination
    const total = await User.countDocuments(searchFilter);

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      sponsors,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSponsorsBySeason = async (req, res) => {
  const { seasonId } = req.params;
  const { query = "", page = 1, limit = 10 } = req.query;

  if (!seasonId) {
    return res.status(400).json({
      success: false,
      message: "Season ID is required",
    });
  }

  const currentPage = parseInt(page);
  const pageLimit = parseInt(limit);
  const skip = (currentPage - 1) * pageLimit;

  try {
    /* -------------------- Build filter -------------------- */
    const filter = {
      role: "sponsor",
      assignedContests: seasonId,
    };

    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ];
    }

    /* -------------------- Fetch sponsors -------------------- */
    const sponsors = await User.find(filter)
      // .select("name email phone profile status assignedContests")
      .skip(skip)
      .limit(pageLimit)
      .sort({ createdAt: -1 }).lean()

    const total = await User.countDocuments(filter);

    return res.status(200).json({
      success: true,
      sponsors,
      totalItems: total,
      currentPage,
      pageSize: pageLimit,
      totalPages: Math.ceil(total / pageLimit),
      hasNextPage: currentPage * pageLimit < total,
      hasPrevPage: currentPage > 1,
    });
  } catch (error) {
    console.error("Error fetching sponsors:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

exports.getallsponsor = async (req, res) => {
  try {
    const data = await User.find({ role: "sponsor", status: "active" });
    res.send({ success: true, data });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
};

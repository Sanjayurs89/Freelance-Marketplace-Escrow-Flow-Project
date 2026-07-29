const bcrypt = require('bcryptjs');

// Global mock database state
const db = {
  users: [],
  jobs: [],
  contracts: [],
  transactions: []
};

const clearDb = () => {
  db.users = [];
  db.jobs = [];
  db.contracts = [];
  db.transactions = [];
};

class MockDocument {
  constructor(data, collectionName) {
    this._id = data._id || Math.random().toString(36).substring(2, 11);
    this.id = this._id.toString();
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this._collectionName = collectionName;
    
    // Copy all data keys
    Object.keys(data).forEach(key => {
      this[key] = data[key];
    });
  }

  async save() {
    // Enforce EscrowTransaction Invariant Check
    if (this._collectionName === 'transactions') {
      const held = this.heldAmount !== undefined ? Number(this.heldAmount) : 0;
      const released = this.releasedAmount !== undefined ? Number(this.releasedAmount) : 0;
      const refunded = this.refundedAmount !== undefined ? Number(this.refundedAmount) : 0;
      const total = held + released + refunded;
      const amount = Number(this.amount);

      if (Math.abs(amount - total) > 0.001) {
        throw new Error(`Invariant violation: funded amount (${amount}) must equal released (${released}) + refunded (${refunded}) + held (${held})`);
      }

      if (['funded', 'in_progress', 'delivered', 'disputed'].includes(this.status)) {
        if (held !== amount || released !== 0 || refunded !== 0) {
          throw new Error(`Validation error: state "${this.status}" requires heldAmount matching amount, and zero released and refunded amounts.`);
        }
      } else if (this.status === 'released') {
        if (held !== 0 || released !== amount || refunded !== 0) {
          throw new Error('Validation error: state "released" requires heldAmount to be 0, releasedAmount matching amount, and zero refundedAmount.');
        }
      } else if (this.status === 'refunded') {
        if (held !== 0 || released !== 0 || refunded !== amount) {
          throw new Error('Validation error: state "refunded" requires heldAmount to be 0, releasedAmount to be 0, and refundedAmount matching amount.');
        }
      }
    }

    const list = db[this._collectionName];
    const index = list.findIndex(item => item._id.toString() === this._id.toString());
    this.updatedAt = new Date();
    
    if (index > -1) {
      list[index] = this;
    } else {
      list.push(this);
    }
    return this;
  }

  populate(path) {
    if (path === 'contract') {
      const contract = db.contracts.find(c => c._id.toString() === this.contract.toString());
      if (contract) {
        const popContract = { ...contract };
        // Populate nested fields
        popContract.job = db.jobs.find(j => j._id.toString() === contract.job.toString()) || contract.job;
        popContract.client = db.users.find(u => u._id.toString() === contract.client.toString()) || contract.client;
        popContract.freelancer = db.users.find(u => u._id.toString() === contract.freelancer.toString()) || contract.freelancer;
        this.contract = popContract;
      }
    }
    return this;
  }
}

// User Model Mock
const UserMock = {
  create: async (data) => {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(data.password, salt);
    const user = new MockDocument({
      ...data,
      password: hashedPassword,
      matchPassword: function(enteredPassword) {
        return bcrypt.compareSync(enteredPassword, this.password);
      }
    }, 'users');
    db.users.push(user);
    return user;
  },
  findOne: async (query) => {
    const user = db.users.find(u => u.email === query.email) || null;
    if (user && !user.matchPassword) {
      user.matchPassword = function(enteredPassword) {
        return bcrypt.compareSync(enteredPassword, this.password);
      };
    }
    return user;
  },
  findById: (id) => {
    const user = db.users.find(u => u._id.toString() === id.toString()) || null;
    return {
      select: (fields) => {
        return {
          then: (resolve) => resolve(user)
        };
      },
      then: (resolve) => resolve(user)
    };
  },
  find: (query) => {
    let results = [...db.users];
    if (query && query.role) {
      results = results.filter(u => u.role === query.role);
    }
    return {
      select: (fields) => {
        return {
          then: (resolve) => resolve(results)
        };
      },
      then: (resolve) => resolve(results)
    };
  }
};

// Job Model Mock
const JobMock = {
  create: async (data) => {
    const job = new MockDocument({ ...data, status: data.status || 'open' }, 'jobs');
    db.jobs.push(job);
    return job;
  },
  find: (query) => {
    let results = [...db.jobs];
    if (query && query.status) {
      results = results.filter(j => j.status === query.status);
    }
    
    const getPopulated = () => {
      return results.map(j => {
        const doc = { ...j };
        doc.postedBy = db.users.find(u => u._id.toString() === j.postedBy.toString()) || j.postedBy;
        return doc;
      });
    };

    return {
      populate: (path, select) => {
        return {
          sort: (sortObj) => {
            return {
              then: (resolve) => resolve(getPopulated())
            };
          },
          then: (resolve) => resolve(getPopulated())
        };
      },
      sort: (sortObj) => {
        return {
          then: (resolve) => resolve(getPopulated())
        };
      },
      then: (resolve) => resolve(getPopulated())
    };
  },
  findById: (id) => {
    const job = db.jobs.find(j => j._id.toString() === id.toString()) || null;
    const getPopulated = () => {
      if (!job) return null;
      const doc = { ...job };
      doc.postedBy = db.users.find(u => u._id.toString() === job.postedBy.toString()) || job.postedBy;
      return doc;
    };

    return {
      populate: (path, select) => {
        return {
          then: (resolve) => resolve(getPopulated())
        };
      },
      then: (resolve) => resolve(job)
    };
  },
  findByIdAndUpdate: async (id, update) => {
    const job = db.jobs.find(j => j._id.toString() === id.toString());
    if (job) {
      Object.assign(job, update);
      job.updatedAt = new Date();
    }
    return job;
  }
};

// Contract Model Mock
const ContractMock = {
  create: async (data) => {
    const contract = new MockDocument({ ...data, status: data.status || 'draft' }, 'contracts');
    db.contracts.push(contract);
    return contract;
  },
  find: (query) => {
    let results = [...db.contracts];
    if (query) {
      if (query.client) results = results.filter(c => c.client.toString() === query.client.toString());
      if (query.freelancer) results = results.filter(c => c.freelancer.toString() === query.freelancer.toString());
    }

    const getPopulated = () => {
      return results.map(c => {
        const doc = { ...c };
        doc.job = db.jobs.find(j => j._id.toString() === c.job.toString()) || c.job;
        doc.client = db.users.find(u => u._id.toString() === c.client.toString()) || c.client;
        doc.freelancer = db.users.find(u => u._id.toString() === c.freelancer.toString()) || c.freelancer;
        return doc;
      });
    };

    return {
      populate: function() {
        return this;
      },
      sort: function() {
        return {
          then: (resolve) => resolve(getPopulated())
        };
      },
      then: (resolve) => resolve(getPopulated())
    };
  },
  findById: (id) => {
    const contract = db.contracts.find(c => c._id.toString() === id.toString()) || null;
    
    const getPopulated = () => {
      if (!contract) return null;
      const doc = new MockDocument(contract, 'contracts');
      const jobObj = db.jobs.find(j => j._id.toString() === contract.job.toString());
      const clientObj = db.users.find(u => u._id.toString() === contract.client.toString());
      const freelancerObj = db.users.find(u => u._id.toString() === contract.freelancer.toString());
      
      doc.job = jobObj ? { ...jobObj } : contract.job;
      doc.client = clientObj ? { ...clientObj } : contract.client;
      doc.freelancer = freelancerObj ? { ...freelancerObj } : contract.freelancer;
      return doc;
    };

    return {
      populate: function() {
        return this;
      },
      then: (resolve) => resolve(getPopulated())
    };
  },
  findOne: async (query) => {
    if (query && query.job) {
      const jobId = query.job.toString();
      const contract = db.contracts.find(c => c.job.toString() === jobId && c.status !== 'cancelled');
      return contract || null;
    }
    return null;
  }
};

// EscrowTransaction Mock
class EscrowTransactionInstance extends MockDocument {
  constructor(data) {
    super(data, 'transactions');
  }
}

const EscrowTransactionMock = function(data) {
  return new EscrowTransactionInstance(data);
};

EscrowTransactionMock.findOne = (query) => {
  const tx = db.transactions.find(t => t.contract.toString() === query.contract.toString());
  const instance = tx ? new EscrowTransactionInstance(tx) : null;
  
  return {
    populate: (path) => {
      if (instance) instance.populate(path);
      return {
        then: (resolve) => resolve(instance)
      };
    },
    then: (resolve) => resolve(instance)
  };
};

EscrowTransactionMock.findById = (id) => {
  const tx = db.transactions.find(t => t._id.toString() === id.toString());
  const instance = tx ? new EscrowTransactionInstance(tx) : null;
  
  return {
    populate: (path) => {
      if (instance) instance.populate(path);
      return {
        then: (resolve) => resolve(instance)
      };
    },
    then: (resolve) => resolve(instance)
  };
};

EscrowTransactionMock.deleteMany = async () => {};

module.exports = {
  db,
  clearDb,
  UserMock,
  JobMock,
  ContractMock,
  EscrowTransactionMock
};

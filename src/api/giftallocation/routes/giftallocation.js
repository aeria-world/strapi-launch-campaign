module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/giftallocation/allocate',
      handler: 'giftallocation.allocateGift',
      config: {
        auth: false,
        policies: [],
        middlewares: ['api::giftallocation.jwt-auth']
      },
    },
  ],
};

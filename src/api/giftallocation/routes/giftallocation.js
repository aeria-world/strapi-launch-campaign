module.exports = {
  routes: [
    // {
    //   method: 'GET',
    //   path: '/giftallocation/fetch',
    //   handler: 'giftallocation.fetchAllGifts',
    //   config: {
    //     auth: false,
    //     policies: [],
    //     middlewares: []
    //   }
    // // },
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

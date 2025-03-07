import { cleanParams, createNewUserInDatabase } from '@/lib/utils';
import { Manager, Property, Tenant } from '@/types/prismaTypes';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import { FiltersState } from '.';

export const api = createApi({
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    prepareHeaders: async (headers) => {
      const session = await fetchAuthSession();
      const { idToken } = session.tokens ?? {};
      if (idToken) {
        headers.set('Authorization', `Bearer ${idToken}`);
      }
      return headers;
    },
  }),
  reducerPath: 'api',
  tagTypes: ['Managers', 'Tenants', 'Properties', 'PropertyDetails'],
  endpoints: (build) => ({
    getAuthUser: build.query<User, void>({
      queryFn: async (_, _queryApi, _extraoptions, fetchWithBQ) => {
        try {
          const session = await fetchAuthSession();
          const { idToken } = session.tokens ?? {};
          const user = await getCurrentUser();
          const userRole = idToken?.payload['custom:role'] as string;

          const endpoint =
            userRole === 'manager'
              ? `/managers/${user.userId}`
              : `/tenants/${user.userId}`;

          let userDetailsResponse = await fetchWithBQ(endpoint);
          // console.log('userDetailsResponse =>', userDetailsResponse);

          // if user doesn't exist, create new user
          if (
            userDetailsResponse.error &&
            userDetailsResponse.error.status === 404
          ) {
            userDetailsResponse = await createNewUserInDatabase(
              user,
              idToken,
              userRole,
              fetchWithBQ
            );
          }

          return {
            data: {
              cognitoInfo: { ...user },
              userInfo: userDetailsResponse.data as Tenant | Manager,
              userRole,
            },
          };
        } catch (error: any) {
          return { error: error.message || 'Could not fetch user data' };
        }
      },
    }),

    updateManagerSettings: build.mutation<
      Tenant,
      { cognitoId: string } & Partial<Tenant>
    >({
      query: ({ cognitoId, ...updatedManager }) => ({
        url: `managers/${cognitoId}`,
        method: 'PUT',
        body: updatedManager,
      }),
      invalidatesTags: (result) => [{ type: 'Managers', id: result?.id }],
    }),

    // property related endpoint
    getProperties: build.query<
      Property[],
      Partial<FiltersState> & { favoriteIds?: number[] }
    >({
      query: (filters) => {
        const params = cleanParams({
          location: filters.location,
          priceMin: filters.priceRange?.[0],
          priceMax: filters.priceRange?.[1],
          beds: filters.beds,
          baths: filters.baths,
          propertyType: filters.propertyType,
          squareFeetMin: filters.squareFeet?.[0],
          squareFeetMax: filters.squareFeet?.[1],
          amenities: filters.amenities?.join(','),
          availableFrom: filters.availableFrom,
          favoriteIds: filters.favoriteIds?.join(','),
          latitude: filters.coordinates?.[1],
          longitude: filters.coordinates?.[0],
        });

        return { url: 'properties', params };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Properties' as const, id })),
              { type: 'Properties', id: 'LIST' },
            ]
          : [{ type: 'Properties', id: 'LIST' }],
    }),

    getProperty: build.query<Property, number>({
      query: (id) => `properties/${id}`,
      providesTags: (result, error, id) => [{ type: 'PropertyDetails', id }],
    }),

    // tenant related endpoints
    getTenant: build.query<Tenant, string>({
      query: (cognitoId) => `tenants/${cognitoId}`,
      providesTags: (result) => [{ type: 'Tenants', id: result?.id }],
    }),

    updateTenantSettings: build.mutation<
      Tenant,
      { cognitoId: string } & Partial<Tenant>
    >({
      query: ({ cognitoId, ...updatedTenant }) => ({
        url: `tenants/${cognitoId}`,
        method: 'PUT',
        body: updatedTenant,
      }),
      invalidatesTags: (result) => [{ type: 'Tenants', id: result?.id }],
    }),

    addFavoriteProperty: build.mutation<
      Tenant, // ✅ 이 mutation이 반환할 데이터의 타입 (즐겨찾기가 추가된 Tenant 객체)
      { cognitoId: string; propertyId: number } // ✅ 이 mutation을 호출할 때 필요한 인자 (cognitoId, propertyId)
    >({
      query: ({ cognitoId, propertyId }) => ({
        // ✅ 실제 API 요청을 생성하는 부분
        url: `tenants/${cognitoId}/favorites/${propertyId}`, // API 엔드포인트 (예: /tenants/abc123/favorites/10)
        method: 'POST', // 📌 즐겨찾기를 추가하는 요청이므로 'POST'
      }),
      invalidatesTags: (result) => [
        { type: 'Tenants', id: result?.id }, // ✅ 테넌트 정보(Tenants) 캐시 무효화 (즐겨찾기 리스트 변경됨)
        { type: 'Properties', id: 'LIST' }, // ✅ 매물 리스트(Properties) 캐시 무효화 (매물 즐겨찾기 상태 변경)
      ],
    }),

    removeFavoriteProperty: build.mutation<
      Tenant, // ✅ API 요청이 성공하면 반환될 데이터의 타입 (업데이트된 Tenant 객체)
      { cognitoId: string; propertyId: number } // ✅ 이 mutation을 호출할 때 필요한 인자 (cognitoId, propertyId)
    >({
      query: ({ cognitoId, propertyId }) => ({
        // ✅ 실제 API 요청을 생성하는 부분
        url: `tenants/${cognitoId}/favorites/${propertyId}`, // API 엔드포인트 (예: /tenants/abc123/favorites/10)
        method: 'DELETE', // 📌 즐겨찾기를 삭제하는 요청이므로 'DELETE'
      }),
      invalidatesTags: (result) => [
        { type: 'Tenants', id: result?.id }, // ✅ 테넌트 정보(Tenants) 캐시 무효화 (즐겨찾기 리스트 변경됨)
        { type: 'Properties', id: 'LIST' }, // ✅ 매물 리스트(Properties) 캐시 무효화 (즐겨찾기 상태 변경)
      ],
    }),
  }),
});

export const {
  useGetAuthUserQuery,
  useUpdateTenantSettingsMutation,
  useUpdateManagerSettingsMutation,
  useGetPropertiesQuery,
  useGetPropertyQuery,
  useGetTenantQuery,
  useAddFavoritePropertyMutation,
  useRemoveFavoritePropertyMutation,
} = api;

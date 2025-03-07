import React from 'react'
import {
  useAddFavoritePropertyMutation,
  useGetAuthUserQuery,
  useGetPropertiesQuery,
  useGetTenantQuery,
  useRemoveFavoritePropertyMutation
} from '@/state/api'
import { useAppSelector } from '@/state/redux'
import { Property } from '@/types/prismaTypes'
import Card from '@/components/Card'
import CardCompact from '@/components/CardCompact'

const Listings = () => {
  const { data: authUser } = useGetAuthUserQuery()
  console.log("authUser ", authUser)
  const { data: tenant } = useGetTenantQuery(
    authUser?.cognitoInfo?.userId || '',
    {
      skip: !authUser?.cognitoInfo?.userId, // ✅ Cognito ID가 있을 때만 실행
    }
  );
  const [addFavorite] = useAddFavoritePropertyMutation()
  const [removeFavorite] = useRemoveFavoritePropertyMutation()
  const viewMode = useAppSelector((state) => state.global.viewMode)
  const filters = useAppSelector((state) => state.global.filters)

  const {
    data: properties,
    isError,
    isLoading
  } = useGetPropertiesQuery(filters)

  const handleFavoriteToggle = async (propertyId: number) => {
    if (!authUser) return

    const isFavorite = tenant?.favorites?.some(
      (fav: Property) => fav.id === propertyId
    )

    if (isFavorite) {
      await removeFavorite({
        cognitoId: authUser.userInfo.cognitoId,
        propertyId
      })
    } else {
      await addFavorite({
        cognitoId: authUser.userInfo.cognitoId,
        propertyId
      })
    }
  }

  if (isLoading) return <>Loading...</>
  if (isError || !properties) return <div>Failed to fetch properties</div>

  return (
    <div className="w-full">
      <h3 className="text-sm px-4 font-bold">
        {properties.length}{' '}
        <span className="text-gray-700 font-normal">
          Places in {filters.location}
        </span>
      </h3>
      <div className="flex">
        <div className="p-4 w-full">
          {properties?.map((property) =>
            viewMode === 'grid' ? (
              <Card
                key={property.id}
                property={property}
                isFavorite={
                  tenant?.favorites?.some(
                    (fav: Property) => fav.id === property.id
                  ) || false
                }
                onFavoriteToggle={() => handleFavoriteToggle(property.id)}
                showFavoriteButton={!!authUser}
                propertyLink={`/search/${property.id}`}
              />
            ) : (
              <CardCompact
                key={property.id}
                property={property}
                isFavorite={
                  tenant?.favorites?.some(
                    (fav: Property) => fav.id === property.id
                  ) || false
                }
                onFavoriteToggle={() => handleFavoriteToggle(property.id)}
                showFavoriteButton={!!authUser}
                propertyLink={`/search/${property.id}`}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default Listings
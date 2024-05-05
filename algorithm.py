import cv2
import cv2.cv2
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import AffinityPropagation

image = cv2.imread('a.jpg')
output = image.copy()
height, width = image.shape[:2]
maxRadius = int(1.1*(width/7)/2)
minRadius = int(0.8*(width/7)/2)

# Add contrast to the image
clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
gray = cv2.GaussianBlur(gray, (9, 9), 1.5, 1.5)

cv2.imwrite('gray.jpg', gray)

circles = cv2.HoughCircles(image=gray, 
                           method=cv2.HOUGH_GRADIENT, 
                           dp=1, 
                           minDist=2*minRadius,
                           param1=30,
                           param2=30,
                           minRadius=minRadius,
                           maxRadius=maxRadius                           
                          )

# Apply Affinity Propagation to cluster the circles based on the y position
if circles is not None:
    circles = np.round(circles[0, :]).astype("int")

    y_positions = circles[:,1]
    y_positions = y_positions.reshape(-1, 1)
    af = AffinityPropagation(damping=0.7).fit(y_positions)
    cluster_centers_indices = af.cluster_centers_indices_
    labels = af.labels_
    n_clusters_ = len(cluster_centers_indices)
    print('Number of clusters: ', n_clusters_)
    print('Labels: ', labels)

    centers = circles[cluster_centers_indices]
    centers_sorted_index = np.argsort(centers[:,1])
    for i in range(len(labels)):
        labels[i] = np.where(centers_sorted_index == labels[i])[0][0]

    # Sort the circles based on the cluster labels. if the cluster labels are the same, sort based on the x position
    circles = circles[np.lexsort((circles[:,0], labels))]
    
    count = 0

    # convert the (x, y) coordinates and radius of the circles to integers
    #circlesRound = np.round(circles[0, :]).astype("int")
    # loop over the (x, y) coordinates and radius of the circles
    for (x, y, r) in circles:
        # Write a purple number in the center of the circle
        cv2.putText(output, str(count), (x, y), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 255), 2)
        #cv2.circle(output, (x, y), r, (0, 255, 0), 4)
        count += 1
    plt.imsave('output.jpg', output)
    plt.imshow(output)
else:
    print ('No circles found')


